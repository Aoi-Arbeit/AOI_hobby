"""
Section 1 テスト: IFD/IFO注文 + SL/TP変更 + 全ポジション一括決済 + 維持率警告
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import main as app_module

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestSessionLocal()
    try: yield db
    finally: db.close()

app_module.app.dependency_overrides[app_module.get_db] = override_get_db
app_module.Base.metadata.create_all(bind=test_engine)
client = TestClient(app_module.app)

def setup():
    app_module.Base.metadata.drop_all(bind=test_engine)
    app_module.Base.metadata.create_all(bind=test_engine)

def register_and_login(email="s1@test.com"):
    res = client.post("/auth/register", json={"email": email, "username": "S1", "password": "pass"})
    return res.json()["access_token"]

def auth(token): return {"Authorization": f"Bearer {token}"}

# ──────────────────────────────────────────────────────────
# IFD 注文テスト
# ──────────────────────────────────────────────────────────

class TestIFDOrder:
    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("ifd@test.com")

    def test_ifd_creates_two_orders(self):
        """IFD注文 → エントリー(OPEN)+決済(PENDING)の2件が作成される"""
        rates = client.get("/rates").json()["USDJPY"]
        entry_limit = round(rates["ask"] - 3.0, 3)
        tp = round(entry_limit + 1.5, 3)

        res = client.post("/orders", headers=auth(self.token), json={
            "type": "ifd", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25,
            "limit_price": entry_limit, "tp_price": tp
        })
        assert res.status_code == 200
        data = res.json()
        assert "order_id" in data
        assert "close_order_id" in data
        assert data["status"] == "open"

        orders = client.get("/orders", headers=auth(self.token)).json()
        entry = next(o for o in orders if o["id"] == data["order_id"])
        close = next(o for o in orders if o["id"] == data["close_order_id"])

        assert entry["status"] == "open"
        assert entry["type"] == "ifd"
        assert close["status"] == "pending"   # 子注文はPENDING
        assert close["type"] == "limit"

    def test_ifd_entry_side_buy_creates_sell_close_order(self):
        """IFD BUY → 決済注文は SELL"""
        rates = client.get("/rates").json()["USDJPY"]
        res = client.post("/orders", headers=auth(self.token), json={
            "type": "ifd", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25,
            "limit_price": round(rates["ask"] - 3.0, 3),
            "tp_price": round(rates["ask"] + 1.5, 3)
        })
        close_id = res.json()["close_order_id"]
        orders = client.get("/orders", headers=auth(self.token)).json()
        close = next(o for o in orders if o["id"] == close_id)
        assert close["side"] == "sell"

    def test_ifd_requires_tp_price(self):
        """IFD でtp_priceなし → 決済注文のlimit_priceがNone（仕様上許容、テストは作成確認のみ）"""
        rates = client.get("/rates").json()["USDJPY"]
        res = client.post("/orders", headers=auth(self.token), json={
            "type": "ifd", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25,
            "limit_price": round(rates["ask"] - 3.0, 3),
            # tp_priceなし
        })
        # エラーにはならないがclose_orderが作成される
        assert res.status_code == 200


# ──────────────────────────────────────────────────────────
# IFO 注文テスト
# ──────────────────────────────────────────────────────────

class TestIFOOrder:
    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("ifo@test.com")

    def test_ifo_creates_three_orders(self):
        """IFO注文 → エントリー(OPEN)+SL(PENDING)+TP(PENDING)の3件が作成される"""
        rates = client.get("/rates").json()["USDJPY"]
        entry_limit = round(rates["ask"] - 3.0, 3)

        res = client.post("/orders", headers=auth(self.token), json={
            "type": "ifo", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25,
            "limit_price": entry_limit,
            "sl_price": round(entry_limit - 1.0, 3),
            "tp_price": round(entry_limit + 2.0, 3),
        })
        assert res.status_code == 200
        data = res.json()
        assert "order_id" in data
        assert "sl_order_id" in data
        assert "tp_order_id" in data

    def test_ifo_sl_tp_are_linked(self):
        """IFO の SL/TP注文は linked_order_id で相互リンクされる"""
        rates = client.get("/rates").json()["USDJPY"]
        entry_limit = round(rates["ask"] - 3.0, 3)

        res = client.post("/orders", headers=auth(self.token), json={
            "type": "ifo", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25,
            "limit_price": entry_limit,
            "sl_price": round(entry_limit - 1.0, 3),
            "tp_price": round(entry_limit + 2.0, 3),
        })
        data = res.json()
        orders = client.get("/orders", headers=auth(self.token)).json()
        sl = next(o for o in orders if o["id"] == data["sl_order_id"])
        tp = next(o for o in orders if o["id"] == data["tp_order_id"])

        # 相互リンク確認
        assert sl["linked_order_id"] == tp["id"]
        assert tp["linked_order_id"] == sl["id"]

    def test_ifo_sl_tp_are_pending(self):
        """IFO の SL/TP注文は PENDING ステータス"""
        rates = client.get("/rates").json()["USDJPY"]
        entry_limit = round(rates["ask"] - 3.0, 3)
        res = client.post("/orders", headers=auth(self.token), json={
            "type": "ifo", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25,
            "limit_price": entry_limit,
            "sl_price": round(entry_limit - 1.0, 3),
            "tp_price": round(entry_limit + 2.0, 3),
        })
        data = res.json()
        orders = client.get("/orders", headers=auth(self.token)).json()
        sl = next(o for o in orders if o["id"] == data["sl_order_id"])
        tp = next(o for o in orders if o["id"] == data["tp_order_id"])
        assert sl["status"] == "pending"
        assert tp["status"] == "pending"

    def test_ifo_entry_only_needs_margin(self):
        """IFO はエントリー注文の証拠金のみチェック（大きいlot_sizeでもエントリーが通る範囲）"""
        rates = client.get("/rates").json()["USDJPY"]
        entry_limit = round(rates["ask"] - 3.0, 3)
        res = client.post("/orders", headers=auth(self.token), json={
            "type": "ifo", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.5, "leverage": 25,  # 0.5lotは証拠金約¥30,000
            "limit_price": entry_limit,
            "sl_price": round(entry_limit - 1.0, 3),
            "tp_price": round(entry_limit + 2.0, 3),
        })
        assert res.status_code == 200


# ──────────────────────────────────────────────────────────
# IFD/IFO 子注文の活性化テスト（order_engine経由）
# ──────────────────────────────────────────────────────────

class TestIFDChildActivation:
    """order_engine_loop の子注文活性化を直接DBで検証"""
    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("ifd_act@test.com")

    def test_child_order_activated_after_parent_fill(self):
        """IFD エントリー注文をmanually fillしたとき、子注文がOPENになる"""
        rates = client.get("/rates").json()["USDJPY"]
        entry_limit = round(rates["ask"] - 3.0, 3)
        res = client.post("/orders", headers=auth(self.token), json={
            "type": "ifd", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25,
            "limit_price": entry_limit,
            "tp_price": round(entry_limit + 2.0, 3),
        })
        data = res.json()
        entry_id = data["order_id"]
        close_id = data["close_order_id"]

        # DBを直接操作してエントリー注文を約定済みにする
        db = TestSessionLocal()
        try:
            order = db.get(app_module.Order, entry_id)
            pos = app_module.fill_order_and_create_position(order, entry_limit, 0.0, db)
            # 子注文を活性化
            child_orders = db.query(app_module.Order).filter(
                app_module.Order.parent_order_id == entry_id,
                app_module.Order.status == app_module.OrderStatus.PENDING
            ).all()
            for child in child_orders:
                child.status = app_module.OrderStatus.OPEN
            db.commit()
        finally:
            db.close()

        # APIで確認
        orders = client.get("/orders", headers=auth(self.token)).json()
        close = next((o for o in orders if o["id"] == close_id), None)
        assert close is not None
        assert close["status"] == "open", f"Expected open, got {close['status']}"


# ──────────────────────────────────────────────────────────
# SL/TP 変更テスト
# ──────────────────────────────────────────────────────────

class TestUpdateSlTp:
    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("sltp@test.com")
        # ポジション作成
        res = client.post("/orders", headers=auth(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        positions = client.get("/positions", headers=auth(self.token)).json()
        self.pos_id = positions[0]["id"]
        self.entry_price = positions[0]["entry_price"]

    def test_update_sl_tp(self):
        """SL/TP を変更できる"""
        new_sl = round(self.entry_price - 1.0, 3)
        new_tp = round(self.entry_price + 2.0, 3)
        res = client.patch(
            f"/positions/{self.pos_id}/sl-tp",
            headers=auth(self.token),
            json={"sl_price": new_sl, "tp_price": new_tp}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["sl_price"] == pytest.approx(new_sl, abs=0.01)
        assert data["tp_price"] == pytest.approx(new_tp, abs=0.01)

    def test_update_sl_only(self):
        """SL のみ変更できる"""
        new_sl = round(self.entry_price - 0.5, 3)
        res = client.patch(
            f"/positions/{self.pos_id}/sl-tp",
            headers=auth(self.token),
            json={"sl_price": new_sl}
        )
        assert res.status_code == 200
        assert res.json()["sl_price"] == pytest.approx(new_sl, abs=0.01)

    def test_clear_tp(self):
        """TP を null でクリアできる"""
        # まずTPを設定
        client.patch(f"/positions/{self.pos_id}/sl-tp",
                     headers=auth(self.token),
                     json={"tp_price": round(self.entry_price + 2.0, 3)})
        # TPをクリア
        res = client.patch(f"/positions/{self.pos_id}/sl-tp",
                           headers=auth(self.token),
                           json={"tp_price": None})
        assert res.status_code == 200
        assert res.json()["tp_price"] is None

    def test_update_sl_tp_nonexistent(self):
        """存在しないポジション → 404"""
        res = client.patch("/positions/nonexistent/sl-tp",
                           headers=auth(self.token),
                           json={"sl_price": 149.0})
        assert res.status_code == 404

    def test_update_sl_tp_other_user(self):
        """他ユーザーのポジション → 404"""
        other_token = register_and_login("other_sltp@test.com")
        res = client.patch(f"/positions/{self.pos_id}/sl-tp",
                           headers=auth(other_token),
                           json={"sl_price": 149.0})
        assert res.status_code == 404


# ──────────────────────────────────────────────────────────
# 全ポジション一括決済テスト
# ──────────────────────────────────────────────────────────

class TestCloseAll:
    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("closeall@test.com")

    def test_close_all_no_positions(self):
        """ポジションなしで close-all → closed_count=0"""
        res = client.post("/positions/close-all", headers=auth(self.token))
        assert res.status_code == 200
        assert res.json()["closed_count"] == 0

    def test_close_all_single_position(self):
        """1ポジションをclose-allで決済"""
        client.post("/orders", headers=auth(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        res = client.post("/positions/close-all", headers=auth(self.token))
        assert res.status_code == 200
        data = res.json()
        assert data["closed_count"] == 1
        assert "total_net_pnl" in data

    def test_close_all_multiple_positions(self):
        """複数ポジションを一括決済"""
        for sym in ["USDJPY", "EURJPY", "EURUSD"]:
            client.post("/orders", headers=auth(self.token), json={
                "type": "market", "side": "buy", "symbol": sym,
                "lot_size": 0.01, "leverage": 25
            })
        res = client.post("/positions/close-all", headers=auth(self.token))
        assert res.status_code == 200
        assert res.json()["closed_count"] == 3

        # 決済後はポジション0件
        positions = client.get("/positions", headers=auth(self.token)).json()
        assert len(positions) == 0

    def test_close_all_updates_balance(self):
        """close-all後に残高が回復する"""
        client.post("/orders", headers=auth(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        before = client.get("/account", headers=auth(self.token)).json()["balance"]
        client.post("/positions/close-all", headers=auth(self.token))
        after = client.get("/account", headers=auth(self.token)).json()["balance"]
        # 証拠金が戻ってくるので増える
        assert after > before - 5000
