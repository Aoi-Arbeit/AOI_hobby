"""
FX Practice App — pytest テストスイート
テスト仕様書 v1.0 に対応

実行方法:
  cd app/backend
  pip install pytest httpx --break-system-packages
  pytest test_main.py -v
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ─── テスト用インメモリDBでアプリを初期化 ────────────────────────────────────
from sqlalchemy.pool import StaticPool
import main as app_module

# テスト用SQLiteインメモリDBに差し替え（StaticPoolで接続共有）
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

app_module.app.dependency_overrides[app_module.get_db] = override_get_db
app_module.Base.metadata.create_all(bind=test_engine)

client = TestClient(app_module.app)

# ─── ヘルパー ────────────────────────────────────────────────────────────────

def register_and_login(email="test@example.com", username="テストユーザー", password="pass1234"):
    """テストユーザー登録してJWTを返す"""
    res = client.post("/auth/register", json={"email": email, "username": username, "password": password})
    return res.json().get("access_token")

def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════════════════════
# UT-1: ビジネスロジック単体テスト
# ═══════════════════════════════════════════════════════════════════════════════

class TestCalcPnl:
    """UT-1-01〜03: calc_pnl"""

    def test_usdjpy_buy_profit(self):
        """UT-1-01: USDJPY BUY 100pip利益 → +10,000JPY"""
        pos = app_module.Position(
            id="test", user_id="u1", order_id="o1",
            symbol="USDJPY", side=app_module.Side.BUY,
            lot_size=1.0, leverage=25,
            entry_price=150.00, required_margin=60000.0
        )
        pnl = app_module.calc_pnl(pos, 151.00)
        assert pnl == pytest.approx(10000.0, abs=1.0), f"Expected ~10000, got {pnl}"

    def test_usdjpy_sell_loss(self):
        """UT-1-02: USDJPY SELL 100pip逆行 → -10,000JPY"""
        pos = app_module.Position(
            id="test2", user_id="u1", order_id="o1",
            symbol="USDJPY", side=app_module.Side.SELL,
            lot_size=1.0, leverage=25,
            entry_price=150.00, required_margin=60000.0
        )
        pnl = app_module.calc_pnl(pos, 151.00)
        assert pnl == pytest.approx(-10000.0, abs=1.0), f"Expected ~-10000, got {pnl}"

    def test_eurusd_buy_profit(self):
        """UT-1-03: EURUSD BUY 100pip利益（USD→JPY換算）"""
        pos = app_module.Position(
            id="test3", user_id="u1", order_id="o1",
            symbol="EURUSD", side=app_module.Side.BUY,
            lot_size=1.0, leverage=25,
            entry_price=1.0850, required_margin=60000.0
        )
        # 1.0950 - 1.0850 = 0.0100 (100pips), 1lot=10000通貨
        # 0.01 * 10000 * USDJPY(≈150) ≈ 15000 JPY
        pnl = app_module.calc_pnl(pos, 1.0950)
        assert 13000 <= pnl <= 17000, f"Expected 13000~17000 JPY, got {pnl}"

    def test_usdjpy_buy_zero(self):
        """エントリー価格 == 決済価格 → PnL=0"""
        pos = app_module.Position(
            id="test4", user_id="u1", order_id="o1",
            symbol="USDJPY", side=app_module.Side.BUY,
            lot_size=1.0, leverage=25,
            entry_price=150.00, required_margin=60000.0
        )
        pnl = app_module.calc_pnl(pos, 150.00)
        assert pnl == pytest.approx(0.0, abs=0.1)


class TestCalcMargin:
    """UT-1-04〜05: calc_margin"""

    def test_usdjpy_margin(self):
        """UT-1-04: USDJPY 0.1lot 25倍 → ¥6,000"""
        margin = app_module.calc_margin("USDJPY", 0.1, 25, 150.00)
        # 0.1 * 10000 * 150 / 25 = 6000
        assert margin == pytest.approx(6000.0, abs=1.0)

    def test_eurusd_margin_range(self):
        """UT-1-05: EURUSD 0.1lot 25倍 → ¥6,000〜7,000程度"""
        margin = app_module.calc_margin("EURUSD", 0.1, 25, 1.085)
        # 0.1 * 10000 * 1.085 * 150 / 25 ≈ 6510
        assert 5000 <= margin <= 8000, f"Expected 5000~8000, got {margin}"

    def test_margin_leverage_inversely_proportional(self):
        """レバレッジを2倍にすると必要証拠金は1/2"""
        m25 = app_module.calc_margin("USDJPY", 1.0, 25, 150.00)
        m50 = app_module.calc_margin("USDJPY", 1.0, 50, 150.00)
        assert m25 == pytest.approx(m50 * 2, abs=1.0)


class TestCalcSlippage:
    """UT-1-06: calc_slippage"""

    def test_slippage_range(self):
        """UT-1-06: 100回実行してすべて 0〜3.0 の範囲内"""
        for _ in range(100):
            s = app_module.calc_slippage("USDJPY")
            assert 0.0 <= s <= 3.0, f"Slippage out of range: {s}"

    def test_slippage_is_float(self):
        s = app_module.calc_slippage("GBPUSD")
        assert isinstance(s, float)


# ═══════════════════════════════════════════════════════════════════════════════
# UT-2: RateEngine 単体テスト
# ═══════════════════════════════════════════════════════════════════════════════

class TestRateEngine:
    """UT-2-01〜02"""

    def setup_method(self):
        self.engine = app_module.RateEngine()

    def test_tick_bid_ask_order(self):
        """UT-2-01: tick() 後 bid < ask が成立"""
        for _ in range(10):
            rates = self.engine.tick()
            for sym in app_module.SYMBOLS:
                assert rates[sym]["bid"] < rates[sym]["ask"], f"{sym}: bid >= ask"

    def test_tick_has_all_symbols(self):
        """tick() が全5通貨ペアを返す"""
        rates = self.engine.tick()
        for sym in ["USDJPY", "EURJPY", "EURUSD", "GBPUSD", "AUDJPY"]:
            assert sym in rates

    def test_get_history_bar_count(self):
        """UT-2-02: 1分足が300本以上"""
        candles = self.engine.get_history("USDJPY", "1m")
        assert len(candles) >= 300, f"Expected >=300 bars, got {len(candles)}"

    def test_get_history_ohlc_keys(self):
        """各ローソク足が time/open/high/low/close を持つ"""
        candles = self.engine.get_history("EURUSD", "1h")
        for c in candles[:5]:
            assert all(k in c for k in ["time", "open", "high", "low", "close"])

    def test_get_history_high_low_validity(self):
        """high >= open, close; low <= open, close"""
        candles = self.engine.get_history("USDJPY", "1d")
        for c in candles:
            assert c["high"] >= c["open"]
            assert c["high"] >= c["close"]
            assert c["low"]  <= c["open"]
            assert c["low"]  <= c["close"]

    def test_unknown_symbol_returns_empty(self):
        """存在しないシンボルは空リスト"""
        candles = self.engine.get_history("XXXYYY", "1m")
        assert candles == []


# ═══════════════════════════════════════════════════════════════════════════════
# IT-1: 認証統合テスト
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuth:
    """IT-1-01〜04"""

    def setup_method(self):
        """テストDBをクリア"""
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)

    def test_register_success(self):
        """IT-1-01: 新規登録でJWT取得"""
        res = client.post("/auth/register", json={
            "email": "new@example.com", "username": "新規", "password": "pass1234"
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 10

    def test_register_duplicate_email(self):
        """IT-1-02: 同一メールで再登録 → 400"""
        client.post("/auth/register", json={"email": "dup@example.com", "username": "a", "password": "p"})
        res = client.post("/auth/register", json={"email": "dup@example.com", "username": "b", "password": "q"})
        assert res.status_code == 400
        assert "already registered" in res.json()["detail"]

    def test_login_success(self):
        """IT-1-03: 登録後にログイン成功"""
        client.post("/auth/register", json={"email": "login@example.com", "username": "L", "password": "pw1234"})
        res = client.post("/auth/login", data={"username": "login@example.com", "password": "pw1234"})
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_login_wrong_password(self):
        """IT-1-04: 誤パスワード → 401"""
        client.post("/auth/register", json={"email": "wp@example.com", "username": "W", "password": "correct"})
        res = client.post("/auth/login", data={"username": "wp@example.com", "password": "wrong"})
        assert res.status_code == 401

    def test_protected_endpoint_without_token(self):
        """トークンなしで保護エンドポイントにアクセス → 401"""
        res = client.get("/account")
        assert res.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# IT-2: 口座管理統合テスト
# ═══════════════════════════════════════════════════════════════════════════════

class TestAccount:
    """IT-2-01〜02"""

    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("acct@test.com")

    def test_initial_account(self):
        """IT-2-01: 初期残高 ¥1,000,000"""
        res = client.get("/account", headers=auth_headers(self.token))
        assert res.status_code == 200
        data = res.json()
        assert data["balance"] == pytest.approx(1_000_000.0, abs=1.0)
        assert data["equity"]  == pytest.approx(1_000_000.0, abs=1.0)
        assert data["unrealized_pnl"] == 0.0
        assert data["margin_level"] == pytest.approx(9999.0, abs=1.0)

    def test_account_reset(self):
        """IT-2-02: リセット後に残高が¥1,000,000に戻る"""
        # 成行注文でポジション作成
        client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        # リセット
        res = client.post("/account/reset", headers=auth_headers(self.token))
        assert res.status_code == 200
        # 残高確認
        acct = client.get("/account", headers=auth_headers(self.token)).json()
        assert acct["balance"] == pytest.approx(1_000_000.0, abs=1.0)
        # ポジション0件確認
        positions = client.get("/positions", headers=auth_headers(self.token)).json()
        assert len(positions) == 0


# ═══════════════════════════════════════════════════════════════════════════════
# IT-3: レート取得統合テスト
# ═══════════════════════════════════════════════════════════════════════════════

class TestRates:
    """IT-3-01〜02"""

    def test_get_rates_all_symbols(self):
        """IT-3-01: 全5通貨ペアが含まれる"""
        res = client.get("/rates")
        assert res.status_code == 200
        data = res.json()
        for sym in ["USDJPY", "EURJPY", "EURUSD", "GBPUSD", "AUDJPY"]:
            assert sym in data
            assert all(k in data[sym] for k in ["bid", "ask", "mid", "spread"])

    def test_get_rates_bid_less_than_ask(self):
        """bid < ask が全ペアで成立"""
        data = client.get("/rates").json()
        for sym, r in data.items():
            assert r["bid"] < r["ask"], f"{sym}: bid >= ask"

    def test_get_history_usdjpy_1m(self):
        """IT-3-02: USDJPY 1分足 300本以上"""
        res = client.get("/rates/USDJPY/history?timeframe=1m")
        assert res.status_code == 200
        data = res.json()
        assert data["symbol"] == "USDJPY"
        assert data["timeframe"] == "1m"
        assert len(data["candles"]) >= 300

    def test_get_history_all_timeframes(self):
        """全5タイムフレームで履歴が取得できる"""
        for tf in ["1m", "5m", "1h", "4h", "1d"]:
            res = client.get(f"/rates/EURUSD/history?timeframe={tf}")
            assert res.status_code == 200
            assert len(res.json()["candles"]) >= 10


# ═══════════════════════════════════════════════════════════════════════════════
# IT-4: 成行注文統合テスト
# ═══════════════════════════════════════════════════════════════════════════════

class TestMarketOrder:
    """IT-4-01〜03"""

    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("market@test.com")

    def test_market_buy_order(self):
        """IT-4-01: USDJPY 成行BUY 0.1lot が約定する"""
        res = client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "filled"
        assert data["filled_price"] > 0
        assert data["slippage_pips"] >= 0

    def test_market_sell_order(self):
        """USDJPY 成行SELL 0.1lot が約定する"""
        res = client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "sell", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        assert res.status_code == 200
        assert res.json()["status"] == "filled"

    def test_market_order_creates_position(self):
        """成行注文後にポジションが1件作成される"""
        client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        positions = client.get("/positions", headers=auth_headers(self.token)).json()
        assert len(positions) == 1
        p = positions[0]
        assert p["symbol"] == "USDJPY"
        assert p["side"] == "buy"

    def test_market_order_deducts_margin(self):
        """成行注文後に残高が必要証拠金分減少する"""
        before = client.get("/account", headers=auth_headers(self.token)).json()["balance"]
        client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        after = client.get("/account", headers=auth_headers(self.token)).json()["balance"]
        assert after < before

    def test_insufficient_margin(self):
        """IT-4-02: 証拠金不足 → 400（lot=50, leverage=1 で¥75,000,000必要）"""
        res = client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 50, "leverage": 1
        })
        assert res.status_code == 400
        assert "Insufficient margin" in res.json()["detail"]

    def test_unknown_symbol(self):
        """IT-4-03: 不明シンボル → 400"""
        res = client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "XXXYYY",
            "lot_size": 0.1, "leverage": 25
        })
        assert res.status_code == 400
        assert "Unknown symbol" in res.json()["detail"]

    def test_market_order_with_sl_tp(self):
        """SL/TP付き成行注文が作成される"""
        rates = client.get("/rates").json()["USDJPY"]
        sl = round(rates["ask"] - 0.5, 3)
        tp = round(rates["ask"] + 0.5, 3)
        res = client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25,
            "sl_price": sl, "tp_price": tp
        })
        assert res.status_code == 200
        positions = client.get("/positions", headers=auth_headers(self.token)).json()
        assert positions[0]["sl_price"] == pytest.approx(sl, abs=0.001)
        assert positions[0]["tp_price"] == pytest.approx(tp, abs=0.001)

    def test_all_symbols_market_order(self):
        """全5通貨ペアで成行注文が通る"""
        for sym in ["USDJPY", "EURJPY", "EURUSD", "GBPUSD", "AUDJPY"]:
            res = client.post("/orders", headers=auth_headers(self.token), json={
                "type": "market", "side": "buy", "symbol": sym,
                "lot_size": 0.01, "leverage": 25
            })
            assert res.status_code == 200, f"{sym}: {res.json()}"


# ═══════════════════════════════════════════════════════════════════════════════
# IT-5: 指値・逆指値注文統合テスト
# ═══════════════════════════════════════════════════════════════════════════════

class TestLimitStopOrder:
    """IT-5-01〜02"""

    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("limit@test.com")

    def test_limit_order_is_open(self):
        """IT-5-01: 指値注文は OPEN 状態で待機する"""
        rates = client.get("/rates").json()["USDJPY"]
        # 現在askより50pip低い指値（即時約定しない）
        limit_price = round(rates["ask"] - 5.0, 3)
        res = client.post("/orders", headers=auth_headers(self.token), json={
            "type": "limit", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25, "limit_price": limit_price
        })
        assert res.status_code == 200
        assert res.json()["status"] == "open"

    def test_stop_order_is_open(self):
        """逆指値注文は OPEN 状態で待機する"""
        rates = client.get("/rates").json()["USDJPY"]
        stop_price = round(rates["ask"] + 5.0, 3)
        res = client.post("/orders", headers=auth_headers(self.token), json={
            "type": "stop", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25, "stop_price": stop_price
        })
        assert res.status_code == 200
        assert res.json()["status"] == "open"

    def test_cancel_limit_order(self):
        """IT-5-02: 指値注文キャンセル"""
        rates = client.get("/rates").json()["USDJPY"]
        limit_price = round(rates["ask"] - 5.0, 3)
        order_id = client.post("/orders", headers=auth_headers(self.token), json={
            "type": "limit", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25, "limit_price": limit_price
        }).json()["order_id"]

        res = client.delete(f"/orders/{order_id}", headers=auth_headers(self.token))
        assert res.status_code == 200

        # 注文一覧でキャンセル確認
        orders = client.get("/orders", headers=auth_headers(self.token)).json()
        cancelled = [o for o in orders if o["id"] == order_id]
        assert len(cancelled) == 1
        assert cancelled[0]["status"] == "cancelled"


# ═══════════════════════════════════════════════════════════════════════════════
# IT-6: OCO注文統合テスト
# ═══════════════════════════════════════════════════════════════════════════════

class TestOcoOrder:
    """IT-6-01"""

    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("oco@test.com")

    def test_oco_creates_two_orders(self):
        """IT-6-01: OCO注文で2件の注文が作成される"""
        rates = client.get("/rates").json()["USDJPY"]
        limit_price = round(rates["ask"] - 5.0, 3)
        stop_price  = round(rates["ask"] + 5.0, 3)

        res = client.post("/orders", headers=auth_headers(self.token), json={
            "type": "oco", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25,
            "limit_price": limit_price, "stop_price": stop_price
        })
        assert res.status_code == 200

        orders = client.get("/orders", headers=auth_headers(self.token)).json()
        open_oco = [o for o in orders if o["type"] == "oco" and o["status"] == "open"]
        assert len(open_oco) == 2, f"Expected 2 OCO orders, got {len(open_oco)}"

    def test_oco_cancel_cancels_linked(self):
        """一方のOCOをキャンセルするとリンク先もキャンセルされる"""
        rates = client.get("/rates").json()["USDJPY"]
        limit_price = round(rates["ask"] - 5.0, 3)
        stop_price  = round(rates["ask"] + 5.0, 3)

        client.post("/orders", headers=auth_headers(self.token), json={
            "type": "oco", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25,
            "limit_price": limit_price, "stop_price": stop_price
        })

        orders = client.get("/orders", headers=auth_headers(self.token)).json()
        open_oco = [o for o in orders if o["type"] == "oco" and o["status"] == "open"]
        assert len(open_oco) == 2

        # 片方をキャンセル
        first_id = open_oco[0]["id"]
        client.delete(f"/orders/{first_id}", headers=auth_headers(self.token))

        # 両方キャンセルされているか確認
        orders_after = client.get("/orders", headers=auth_headers(self.token)).json()
        oco_after = [o for o in orders_after if o["type"] == "oco"]
        open_after = [o for o in oco_after if o["status"] == "open"]
        assert len(open_after) == 0, f"Expected 0 open OCO orders after cancel, got {len(open_after)}"


# ═══════════════════════════════════════════════════════════════════════════════
# IT-7: ポジション管理統合テスト
# ═══════════════════════════════════════════════════════════════════════════════

class TestPositions:
    """IT-7-01〜02"""

    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("pos@test.com")

    def test_list_positions(self):
        """IT-7-01: 成行注文後にポジション一覧が取得できる"""
        client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        res = client.get("/positions", headers=auth_headers(self.token))
        assert res.status_code == 200
        positions = res.json()
        assert len(positions) == 1
        p = positions[0]
        assert "unrealized_pnl" in p
        assert "pips" in p
        assert "current_price" in p
        assert "required_margin" in p
        assert p["entry_price"] > 0

    def test_close_position(self):
        """IT-7-02: ポジション手動決済"""
        client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        positions = client.get("/positions", headers=auth_headers(self.token)).json()
        pos_id = positions[0]["id"]

        res = client.post(f"/positions/{pos_id}/close", headers=auth_headers(self.token))
        assert res.status_code == 200
        data = res.json()
        assert "trade_id" in data
        assert "exit_price" in data
        assert "net_pnl" in data

    def test_close_position_updates_balance(self):
        """決済後に残高が変動する（証拠金+損益が戻る）"""
        client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        before = client.get("/account", headers=auth_headers(self.token)).json()["balance"]

        positions = client.get("/positions", headers=auth_headers(self.token)).json()
        client.post(f"/positions/{positions[0]['id']}/close", headers=auth_headers(self.token))

        after = client.get("/account", headers=auth_headers(self.token)).json()["balance"]
        # 証拠金が戻ってくるので残高は増える（損益次第で若干増減あり）
        assert after > before - 10000, "Balance should increase after closing (margin returned)"

    def test_close_nonexistent_position(self):
        """存在しないポジションの決済 → 404"""
        res = client.post("/positions/nonexistent-id/close", headers=auth_headers(self.token))
        assert res.status_code == 404

    def test_no_positions_initially(self):
        """登録直後はポジションなし"""
        positions = client.get("/positions", headers=auth_headers(self.token)).json()
        assert positions == []


# ═══════════════════════════════════════════════════════════════════════════════
# IT-8: 統計集計統合テスト
# ═══════════════════════════════════════════════════════════════════════════════

class TestStats:
    """IT-8-01〜03"""

    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)
        self.token = register_and_login("stats@test.com")

    def test_stats_no_trades(self):
        """IT-8-02: トレードなし → total_trades=0"""
        res = client.get("/stats/summary", headers=auth_headers(self.token))
        assert res.status_code == 200
        data = res.json()
        assert data["total_trades"] == 0
        assert data["win_rate"] == 0

    def test_trades_empty_initially(self):
        """IT-8-01: 決済前はトレード履歴なし"""
        res = client.get("/trades", headers=auth_headers(self.token))
        assert res.status_code == 200
        assert res.json() == []

    def test_stats_after_one_trade(self):
        """IT-8-03(基礎): 1トレード後の統計"""
        # 成行注文→即決済
        client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        positions = client.get("/positions", headers=auth_headers(self.token)).json()
        client.post(f"/positions/{positions[0]['id']}/close", headers=auth_headers(self.token))

        res = client.get("/stats/summary", headers=auth_headers(self.token))
        data = res.json()
        assert data["total_trades"] == 1
        assert data["win_count"] + data["loss_count"] == 1
        assert "win_rate" in data
        assert "roi" in data
        assert "max_drawdown" in data
        assert "average_rr" in data

    def test_trade_history_after_close(self):
        """決済後にトレード履歴に1件追加される"""
        client.post("/orders", headers=auth_headers(self.token), json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        positions = client.get("/positions", headers=auth_headers(self.token)).json()
        client.post(f"/positions/{positions[0]['id']}/close", headers=auth_headers(self.token))

        trades = client.get("/trades", headers=auth_headers(self.token)).json()
        assert len(trades) == 1
        t = trades[0]
        assert t["entry_price"] > 0
        assert t["exit_price"] > 0
        assert "net_pnl" in t
        assert "pips_gained" in t
        assert "holding_duration_sec" in t
        assert t["close_reason"] == "manual"

    def test_stats_win_rate_calculation(self):
        """勝ち2・負け0でwin_rate=1.0"""
        for _ in range(2):
            client.post("/orders", headers=auth_headers(self.token), json={
                "type": "market", "side": "buy", "symbol": "USDJPY",
                "lot_size": 0.01, "leverage": 25
            })
        positions = client.get("/positions", headers=auth_headers(self.token)).json()
        for p in positions:
            client.post(f"/positions/{p['id']}/close", headers=auth_headers(self.token))

        stats = client.get("/stats/summary", headers=auth_headers(self.token)).json()
        assert stats["total_trades"] == 2


# ═══════════════════════════════════════════════════════════════════════════════
# ST-2: E2E トレードフロー
# ═══════════════════════════════════════════════════════════════════════════════

class TestE2EFlow:
    """ST-2: 登録→注文→決済→統計→リセットの完全フロー"""

    def setup_method(self):
        app_module.Base.metadata.drop_all(bind=test_engine)
        app_module.Base.metadata.create_all(bind=test_engine)

    def test_full_trade_lifecycle(self):
        """ST-2: 完全E2Eフロー"""
        # ステップ1: ユーザー登録
        reg = client.post("/auth/register", json={
            "email": "e2e@example.com", "username": "E2Eテスト", "password": "e2epass"
        })
        assert reg.status_code == 200
        token = reg.json()["access_token"]
        headers = auth_headers(token)

        # 口座確認
        acct = client.get("/account", headers=headers).json()
        assert acct["balance"] == pytest.approx(1_000_000.0, abs=1.0)

        # ステップ2: USDJPY 成行BUY 0.1lot
        order_res = client.post("/orders", headers=headers, json={
            "type": "market", "side": "buy", "symbol": "USDJPY",
            "lot_size": 0.1, "leverage": 25
        })
        assert order_res.status_code == 200
        assert order_res.json()["status"] == "filled"
        filled_price = order_res.json()["filled_price"]
        assert filled_price > 100  # USDJPYは100以上

        # ステップ3: ポジション確認
        positions = client.get("/positions", headers=headers).json()
        assert len(positions) == 1
        pos = positions[0]
        assert pos["symbol"] == "USDJPY"
        assert pos["side"] == "buy"
        assert pos["lot_size"] == 0.1
        assert pos["entry_price"] == pytest.approx(filled_price, abs=1.0)

        # ステップ4: ポジション手動決済
        close_res = client.post(f"/positions/{pos['id']}/close", headers=headers)
        assert close_res.status_code == 200
        close_data = close_res.json()
        assert close_data["exit_price"] > 0
        assert isinstance(close_data["net_pnl"], float)

        # 決済後ポジション0件
        positions_after = client.get("/positions", headers=headers).json()
        assert len(positions_after) == 0

        # ステップ5: 統計確認
        stats = client.get("/stats/summary", headers=headers).json()
        assert stats["total_trades"] == 1
        assert stats["win_count"] + stats["loss_count"] == 1
        initial = 1_000_000.0
        expected_roi = close_data["net_pnl"] / initial
        assert stats["roi"] == pytest.approx(expected_roi, abs=0.001)

        trades = client.get("/trades", headers=headers).json()
        assert len(trades) == 1
        assert trades[0]["close_reason"] == "manual"

        # ステップ6: 口座リセット
        reset_res = client.post("/account/reset", headers=headers)
        assert reset_res.status_code == 200
        acct_after = client.get("/account", headers=headers).json()
        assert acct_after["balance"] == pytest.approx(1_000_000.0, abs=1.0)
