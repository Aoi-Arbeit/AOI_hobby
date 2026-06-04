"""
Section 3+4 テスト: 経済指標カレンダーAPI + エリオット波動アノテーション
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import main as app_module

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestSessionLocal()
    try: yield db
    finally: db.close()

app_module.app.dependency_overrides[app_module.get_db] = override_get_db
app_module.Base.metadata.create_all(bind=test_engine)

# テスト用シードデータを投入
_db = TestSessionLocal()
app_module._seed_economic_events(_db)
_db.close()

client = TestClient(app_module.app)

def register_and_login(email="s34@test.com"):
    res = client.post("/auth/register", json={"email": email, "username": "S34", "password": "pass"})
    return res.json()["access_token"]

def auth(token): return {"Authorization": f"Bearer {token}"}


# ──────────────────────────────────────────────────────────
# Section 3: 経済指標カレンダーテスト
# ──────────────────────────────────────────────────────────

class TestEconomicEvents:
    def test_get_events_returns_list(self):
        """GET /economic/events → リストが返る"""
        res = client.get("/economic/events")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_events_have_required_fields(self):
        """各イベントに必要フィールドが含まれる"""
        data = client.get("/economic/events").json()
        if not data:
            pytest.skip("No events seeded in this time window")
        event = data[0]
        for field in ["id", "title", "country", "currency", "importance",
                      "scheduled_at_utc", "scheduled_at_jst", "forecast", "previous"]:
            assert field in event, f"Missing: {field}"

    def test_events_importance_values(self):
        """importance は low/medium/high のいずれか"""
        data = client.get("/economic/events").json()
        for e in data:
            assert e["importance"] in ["low", "medium", "high"]

    def test_events_jst_format(self):
        """scheduled_at_jst が JST 形式"""
        data = client.get("/economic/events").json()
        for e in data:
            assert "JST" in e["scheduled_at_jst"]

    def test_filter_by_importance_high(self):
        """重要度フィルタ: high のみ"""
        data = client.get("/economic/events?importance=high").json()
        for e in data:
            assert e["importance"] == "high"

    def test_filter_by_country_us(self):
        """国フィルタ: US のみ"""
        data = client.get("/economic/events?country=US").json()
        for e in data:
            assert e["country"] == "US"

    def test_get_event_detail(self):
        """GET /economic/events/{id} → 詳細が返る"""
        all_events = client.get("/economic/events?days=30").json()
        if not all_events:
            pytest.skip("No events")
        event_id = all_events[0]["id"]
        res = client.get(f"/economic/events/{event_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == event_id
        assert "description" in data

    def test_get_event_not_found(self):
        """存在しないイベント → 404"""
        res = client.get("/economic/events/nonexistent-id")
        assert res.status_code == 404

    def test_events_no_auth_required(self):
        """認証不要でアクセスできる"""
        res = client.get("/economic/events")
        assert res.status_code == 200

    def test_events_seed_data_count(self):
        """シードデータが複数件入っている"""
        # days=30 で広い範囲を指定
        data = client.get("/economic/events?days=30").json()
        assert len(data) >= 5, f"Expected at least 5 events, got {len(data)}"


# ──────────────────────────────────────────────────────────
# Section 4: エリオット波動アノテーションテスト
# ──────────────────────────────────────────────────────────

class TestWaveAnnotations:
    def setup_method(self):
        # アノテーションのみクリア（経済指標は維持）
        db = TestSessionLocal()
        db.query(app_module.WaveAnnotation).delete()
        db.commit()
        db.close()
        self.token = register_and_login(f"wave_{id(self)}@test.com")

    def test_list_empty(self):
        """初期状態はアノテーションなし"""
        res = client.get("/annotations", headers=auth(self.token))
        assert res.status_code == 200
        assert res.json() == []

    def test_create_annotation(self):
        """アノテーションを作成できる"""
        res = client.post("/annotations", headers=auth(self.token), json={
            "symbol": "USDJPY", "timeframe": "1h",
            "label": "1", "price": 150.50, "timestamp": 1700000000,
            "color": "#FF0000", "note": "第1波の頂点"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["label"] == "1"
        assert data["symbol"] == "USDJPY"
        assert data["timeframe"] == "1h"
        assert data["price"] == pytest.approx(150.50, abs=0.01)

    def test_create_annotation_invalid_symbol(self):
        """不明シンボル → 400"""
        res = client.post("/annotations", headers=auth(self.token), json={
            "symbol": "XXXYYY", "timeframe": "1h",
            "label": "1", "price": 100.0, "timestamp": 1700000000
        })
        assert res.status_code == 400

    def test_list_after_create(self):
        """作成後にリストに1件含まれる"""
        client.post("/annotations", headers=auth(self.token), json={
            "symbol": "USDJPY", "timeframe": "4h",
            "label": "A", "price": 148.00, "timestamp": 1700000000
        })
        res = client.get("/annotations", headers=auth(self.token))
        assert len(res.json()) == 1

    def test_filter_by_symbol(self):
        """シンボルフィルタ"""
        for sym in ["USDJPY", "EURJPY"]:
            client.post("/annotations", headers=auth(self.token), json={
                "symbol": sym, "timeframe": "1h",
                "label": "1", "price": 150.0, "timestamp": 1700000000
            })
        res = client.get("/annotations?symbol=USDJPY", headers=auth(self.token))
        data = res.json()
        assert all(a["symbol"] == "USDJPY" for a in data)
        assert len(data) == 1

    def test_filter_by_timeframe(self):
        """タイムフレームフィルタ"""
        for tf in ["1h", "4h", "1d"]:
            client.post("/annotations", headers=auth(self.token), json={
                "symbol": "USDJPY", "timeframe": tf,
                "label": "1", "price": 150.0, "timestamp": 1700000000
            })
        res = client.get("/annotations?timeframe=4h", headers=auth(self.token))
        data = res.json()
        assert all(a["timeframe"] == "4h" for a in data)

    def test_update_annotation(self):
        """アノテーションを更新できる"""
        create_res = client.post("/annotations", headers=auth(self.token), json={
            "symbol": "USDJPY", "timeframe": "1h",
            "label": "1", "price": 150.50, "timestamp": 1700000000
        })
        ann_id = create_res.json()["id"]

        res = client.patch(f"/annotations/{ann_id}", headers=auth(self.token), json={
            "label": "2", "note": "修正メモ", "color": "#00FF00"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["label"] == "2"
        assert data["note"] == "修正メモ"
        assert data["color"] == "#00FF00"

    def test_update_nonexistent(self):
        """存在しないアノテーション → 404"""
        res = client.patch("/annotations/nonexistent", headers=auth(self.token),
                           json={"label": "X"})
        assert res.status_code == 404

    def test_delete_annotation(self):
        """アノテーションを削除できる"""
        create_res = client.post("/annotations", headers=auth(self.token), json={
            "symbol": "USDJPY", "timeframe": "1h",
            "label": "3", "price": 151.0, "timestamp": 1700000001
        })
        ann_id = create_res.json()["id"]

        res = client.delete(f"/annotations/{ann_id}", headers=auth(self.token))
        assert res.status_code == 200

        remaining = client.get("/annotations", headers=auth(self.token)).json()
        assert all(a["id"] != ann_id for a in remaining)

    def test_delete_other_user_annotation(self):
        """他ユーザーのアノテーション → 404"""
        create_res = client.post("/annotations", headers=auth(self.token), json={
            "symbol": "USDJPY", "timeframe": "1h",
            "label": "1", "price": 150.0, "timestamp": 1700000000
        })
        ann_id = create_res.json()["id"]

        other_token = register_and_login("other_wave@test.com")
        res = client.delete(f"/annotations/{ann_id}", headers=auth(other_token))
        assert res.status_code == 404

    def test_bulk_delete(self):
        """指定ペア・時間軸の全アノテーションを一括削除"""
        for i in range(3):
            client.post("/annotations", headers=auth(self.token), json={
                "symbol": "USDJPY", "timeframe": "1h",
                "label": str(i+1), "price": 150.0 + i, "timestamp": 1700000000 + i
            })
        # EURJPY にも追加
        client.post("/annotations", headers=auth(self.token), json={
            "symbol": "EURJPY", "timeframe": "1h",
            "label": "1", "price": 162.0, "timestamp": 1700000000
        })

        res = client.delete("/annotations?symbol=USDJPY&timeframe=1h",
                            headers=auth(self.token))
        assert res.status_code == 200
        assert res.json()["deleted_count"] == 3

        remaining = client.get("/annotations", headers=auth(self.token)).json()
        # EURJPYのアノテーションは残る
        assert len(remaining) == 1
        assert remaining[0]["symbol"] == "EURJPY"

    def test_annotations_isolated_per_user(self):
        """ユーザー間でアノテーションが独立している"""
        client.post("/annotations", headers=auth(self.token), json={
            "symbol": "USDJPY", "timeframe": "1h",
            "label": "1", "price": 150.0, "timestamp": 1700000000
        })
        other_token = register_and_login("isolated_wave@test.com")
        other_anns = client.get("/annotations", headers=auth(other_token)).json()
        assert other_anns == []

    def test_elliott_wave_labels(self):
        """エリオット波動の全波動ラベルが使えること"""
        for label in ["1", "2", "3", "4", "5", "A", "B", "C"]:
            res = client.post("/annotations", headers=auth(self.token), json={
                "symbol": "USDJPY", "timeframe": "1d",
                "label": label, "price": 150.0, "timestamp": 1700000000
            })
            assert res.status_code == 200
        anns = client.get("/annotations?symbol=USDJPY&timeframe=1d",
                          headers=auth(self.token)).json()
        assert len(anns) == 8
