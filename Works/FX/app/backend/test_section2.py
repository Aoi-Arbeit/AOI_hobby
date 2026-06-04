"""
Section 2 テスト: 月次・週次・通貨ペア別統計 + CSVエクスポート
"""
import pytest, csv, io
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
client = TestClient(app_module.app)

def register_and_login(email="s2@test.com"):
    res = client.post("/auth/register", json={"email": email, "username": "S2", "password": "pass"})
    return res.json()["access_token"]

def auth(token): return {"Authorization": f"Bearer {token}"}

def make_trade(token):
    """成行注文→即決済でトレードを1件作成し、net_pnlを返す"""
    client.post("/orders", headers=auth(token), json={
        "type": "market", "side": "buy", "symbol": "USDJPY",
        "lot_size": 0.01, "leverage": 25
    })
    positions = client.get("/positions", headers=auth(token)).json()
    pos_id = positions[0]["id"]
    res = client.post(f"/positions/{pos_id}/close", headers=auth(token))
    return res.json()["net_pnl"]


# ──────────────────────────────────────────────────────────
# 月次統計テスト
# ──────────────────────────────────────────────────────────

class TestStatsMonthly:
    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("monthly@test.com")

    def test_monthly_empty(self):
        """トレードなし → 空リスト"""
        res = client.get("/stats/monthly", headers=auth(self.token))
        assert res.status_code == 200
        assert res.json() == []

    def test_monthly_after_trade(self):
        """トレード後に月次データが1件返る"""
        make_trade(self.token)
        res = client.get("/stats/monthly", headers=auth(self.token))
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1
        month = data[0]
        assert "month" in month
        assert "total_trades" in month
        assert "win_rate" in month
        assert "total_pnl_jpy" in month
        assert "roi" in month
        assert "profit_factor" in month

    def test_monthly_total_trades_count(self):
        """3トレードで月次の合計件数=3"""
        for _ in range(3):
            make_trade(self.token)
        data = client.get("/stats/monthly", headers=auth(self.token)).json()
        total = sum(m["total_trades"] for m in data)
        assert total == 3

    def test_monthly_win_loss_sum_equals_total(self):
        """win_count + loss_count == total_trades"""
        for _ in range(5):
            make_trade(self.token)
        data = client.get("/stats/monthly", headers=auth(self.token)).json()
        for month in data:
            assert month["win_count"] + month["loss_count"] == month["total_trades"]

    def test_monthly_roi_format(self):
        """roi は小数（例: 0.001 等）"""
        make_trade(self.token)
        data = client.get("/stats/monthly", headers=auth(self.token)).json()
        assert isinstance(data[0]["roi"], float)


# ──────────────────────────────────────────────────────────
# 週次統計テスト
# ──────────────────────────────────────────────────────────

class TestStatsWeekly:
    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("weekly@test.com")

    def test_weekly_empty(self):
        """トレードなし → 空リスト"""
        res = client.get("/stats/weekly", headers=auth(self.token))
        assert res.status_code == 200
        assert res.json() == []

    def test_weekly_after_trade(self):
        """トレード後に週次データが1件返る"""
        make_trade(self.token)
        data = client.get("/stats/weekly", headers=auth(self.token)).json()
        assert len(data) >= 1
        week = data[0]
        assert "week" in week
        assert "total_trades" in week
        assert "win_rate" in week
        assert "total_pnl_jpy" in week

    def test_weekly_win_loss_sum(self):
        """win_count + loss_count == total_trades"""
        for _ in range(4):
            make_trade(self.token)
        data = client.get("/stats/weekly", headers=auth(self.token)).json()
        for week in data:
            assert week["win_count"] + week["loss_count"] == week["total_trades"]

    def test_weekly_format_year_week(self):
        """week は YYYY-Www 形式"""
        make_trade(self.token)
        data = client.get("/stats/weekly", headers=auth(self.token)).json()
        import re
        assert re.match(r"\d{4}-W\d{2}", data[0]["week"])


# ──────────────────────────────────────────────────────────
# 通貨ペア別統計テスト
# ──────────────────────────────────────────────────────────

class TestStatsBySymbol:
    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("bysym@test.com")

    def test_by_symbol_empty(self):
        """トレードなし → 空リスト"""
        res = client.get("/stats/by-symbol", headers=auth(self.token))
        assert res.status_code == 200
        assert res.json() == []

    def test_by_symbol_one_pair(self):
        """USDJPY だけトレードした場合"""
        make_trade(self.token)
        data = client.get("/stats/by-symbol", headers=auth(self.token)).json()
        assert len(data) == 1
        assert data[0]["symbol"] == "USDJPY"
        assert "total_trades" in data[0]
        assert "win_rate" in data[0]
        assert "avg_holding_sec" in data[0]

    def test_by_symbol_multiple_pairs(self):
        """複数ペアをトレードすると各ペアのデータが返る"""
        for sym in ["USDJPY", "EURJPY", "EURUSD"]:
            client.post("/orders", headers=auth(self.token), json={
                "type": "market", "side": "buy", "symbol": sym,
                "lot_size": 0.01, "leverage": 25
            })
            pos = client.get("/positions", headers=auth(self.token)).json()
            client.post(f"/positions/{pos[0]['id']}/close", headers=auth(self.token))

        data = client.get("/stats/by-symbol", headers=auth(self.token)).json()
        symbols = {d["symbol"] for d in data}
        assert "USDJPY" in symbols
        assert "EURJPY" in symbols
        assert "EURUSD" in symbols

    def test_by_symbol_win_loss_sum(self):
        """win_count + loss_count == total_trades（全ペア）"""
        for _ in range(3):
            make_trade(self.token)
        data = client.get("/stats/by-symbol", headers=auth(self.token)).json()
        for sym in data:
            assert sym["win_count"] + sym["loss_count"] == sym["total_trades"]


# ──────────────────────────────────────────────────────────
# CSVエクスポートテスト
# ──────────────────────────────────────────────────────────

class TestExportCsv:
    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("csv@test.com")

    def test_export_empty(self):
        """トレードなしでもCSVが返る（ヘッダーのみ）"""
        res = client.get("/trades/export", headers=auth(self.token))
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        lines = res.text.strip().split("\n")
        assert len(lines) == 1  # ヘッダーのみ

    def test_export_header_columns(self):
        """CSVヘッダーに必要カラムが含まれる"""
        res = client.get("/trades/export", headers=auth(self.token))
        reader = csv.reader(io.StringIO(res.text))
        header = next(reader)
        for col in ["symbol", "side", "net_pnl", "entry_price", "exit_price", "close_reason"]:
            assert col in header, f"Missing column: {col}"

    def test_export_with_trades(self):
        """トレードありでデータ行が含まれる"""
        for _ in range(3):
            make_trade(self.token)
        res = client.get("/trades/export", headers=auth(self.token))
        lines = [l for l in res.text.strip().split("\n") if l]
        assert len(lines) == 4  # ヘッダー + 3行

    def test_export_jst_timestamp(self):
        """opened_at_jst / closed_at_jst カラムが存在する"""
        make_trade(self.token)
        res = client.get("/trades/export", headers=auth(self.token))
        reader = csv.reader(io.StringIO(res.text))
        header = next(reader)
        assert "opened_at_jst" in header
        assert "closed_at_jst" in header

    def test_export_content_disposition(self):
        """Content-Disposition ヘッダーが attachment; filename=trades.csv"""
        res = client.get("/trades/export", headers=auth(self.token))
        assert "attachment" in res.headers.get("content-disposition", "")
        assert "trades.csv" in res.headers.get("content-disposition", "")
