"""
FX Practice App — Backend MVP
FastAPI + SQLite + Mock Rate Engine + WebSocket
"""
import asyncio, enum, json, math, random, uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import Column, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────
SECRET_KEY      = "fx-dev-secret-key-2026-change-in-production"
ALGORITHM       = "HS256"
TOKEN_EXPIRE_H  = 24
INITIAL_BALANCE = 1_000_000.0   # ¥1,000,000
LOTS_PER_UNIT   = 10_000        # 1 lot = 10,000 通貨
LOSS_CUT_LEVEL  = 1.00          # 維持率 100% でロスカット

SYMBOLS: Dict[str, dict] = {
    "USDJPY": {"price": 150.00, "pip": 0.01,   "spread": 0.02,   "vol": 0.008},
    "EURJPY": {"price": 162.00, "pip": 0.01,   "spread": 0.03,   "vol": 0.010},
    "EURUSD": {"price": 1.0850, "pip": 0.0001, "spread": 0.0002, "vol": 0.00006},
    "GBPUSD": {"price": 1.2700, "pip": 0.0001, "spread": 0.0003, "vol": 0.00008},
    "AUDJPY": {"price":  98.00, "pip": 0.01,   "spread": 0.03,   "vol": 0.008},
}

# ─────────────────────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────────────────────
engine       = create_engine("sqlite:////tmp/fx_practice.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase): pass

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────
class OrderStatus(str, enum.Enum):
    PENDING = "pending"; OPEN = "open"; FILLED = "filled"
    CANCELLED = "cancelled"; REJECTED = "rejected"

class OrderType(str, enum.Enum):
    MARKET = "market"; LIMIT = "limit"; STOP = "stop"; OCO = "oco"; IFD = "ifd"; IFO = "ifo"

class Side(str, enum.Enum):
    BUY = "buy"; SELL = "sell"

class PositionStatus(str, enum.Enum):
    OPEN = "open"; CLOSED = "closed"

class CloseReason(str, enum.Enum):
    MANUAL = "manual"; TP = "tp"; SL = "sl"; LOSS_CUT = "loss_cut"

# ─────────────────────────────────────────────────────────────────────────────
# ORM Models
# ─────────────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email         = Column(String, unique=True, nullable=False, index=True)
    username      = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    account       = relationship("VirtualAccount", back_populates="user", uselist=False, cascade="all, delete-orphan")
    orders        = relationship("Order",    back_populates="user")
    positions     = relationship("Position", back_populates="user")
    trades        = relationship("Trade",    back_populates="user")

class VirtualAccount(Base):
    __tablename__   = "virtual_accounts"
    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id         = Column(String, ForeignKey("users.id"), unique=True)
    balance         = Column(Float, default=INITIAL_BALANCE)
    initial_balance = Column(Float, default=INITIAL_BALANCE)
    user            = relationship("User", back_populates="account")

class Order(Base):
    __tablename__    = "orders"
    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id          = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type             = Column(SAEnum(OrderType), nullable=False)
    side             = Column(SAEnum(Side), nullable=False)
    symbol           = Column(String, nullable=False)
    lot_size         = Column(Float, nullable=False)
    leverage         = Column(Integer, nullable=False, default=25)
    limit_price      = Column(Float, nullable=True)
    stop_price       = Column(Float, nullable=True)
    sl_price         = Column(Float, nullable=True)
    tp_price         = Column(Float, nullable=True)
    status           = Column(SAEnum(OrderStatus), default=OrderStatus.PENDING, index=True)
    filled_price     = Column(Float, nullable=True)
    slippage_pips    = Column(Float, nullable=True, default=0.0)
    linked_order_id  = Column(String, nullable=True)
    parent_order_id  = Column(String, nullable=True)
    filled_at        = Column(DateTime, nullable=True)
    cancelled_at     = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user             = relationship("User", back_populates="orders")

class Position(Base):
    __tablename__   = "positions"
    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id         = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    order_id        = Column(String, nullable=False)
    symbol          = Column(String, nullable=False)
    side            = Column(SAEnum(Side), nullable=False)
    lot_size        = Column(Float, nullable=False)
    leverage        = Column(Integer, nullable=False)
    entry_price     = Column(Float, nullable=False)
    sl_price        = Column(Float, nullable=True)
    tp_price        = Column(Float, nullable=True)
    required_margin = Column(Float, nullable=False)
    status          = Column(SAEnum(PositionStatus), default=PositionStatus.OPEN, index=True)
    opened_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    closed_at       = Column(DateTime, nullable=True)
    user            = relationship("User", back_populates="positions")

class Trade(Base):
    __tablename__        = "trades"
    id                   = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id              = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    position_id          = Column(String, nullable=False)
    symbol               = Column(String, nullable=False)
    side                 = Column(SAEnum(Side), nullable=False)
    lot_size             = Column(Float, nullable=False)
    leverage             = Column(Integer, nullable=False)
    entry_price          = Column(Float, nullable=False)
    exit_price           = Column(Float, nullable=False)
    net_pnl              = Column(Float, nullable=False)
    pips_gained          = Column(Float, nullable=False)
    holding_duration_sec = Column(Integer, nullable=False)
    close_reason         = Column(SAEnum(CloseReason), nullable=False)
    slippage_pips        = Column(Float, default=0.0)
    opened_at            = Column(DateTime, nullable=False)
    closed_at            = Column(DateTime, nullable=False, index=True)
    user                 = relationship("User", back_populates="trades")

# ─────────────────────────────────────────────────────────────────────────────
# Mock Rate Engine
# ─────────────────────────────────────────────────────────────────────────────
class RateEngine:
    """ランダムウォークで為替レートをシミュレート"""
    TIMEFRAMES = {"1m": 60, "5m": 300, "1h": 3600, "4h": 14400, "1d": 86400}

    def __init__(self):
        self.mids: Dict[str, float] = {s: d["price"] for s, d in SYMBOLS.items()}
        self.candles: Dict[str, Dict[str, list]] = {}
        self._init_history()

    def _init_history(self, bars: int = 300):
        now = datetime.now(timezone.utc)
        for sym, cfg in SYMBOLS.items():
            self.candles[sym] = {}
            for tf_name, tf_sec in self.TIMEFRAMES.items():
                p = cfg["price"] * (1 - random.uniform(0.01, 0.03))
                candles = []
                for i in range(bars, 0, -1):
                    ts = now - timedelta(seconds=tf_sec * i)
                    open_p = p
                    moves = [random.gauss(0, cfg["vol"]) for _ in range(10)]
                    close_p = open_p + sum(moves)
                    high_p = max(open_p, close_p) + abs(random.gauss(0, cfg["vol"] * 1.5))
                    low_p  = min(open_p, close_p) - abs(random.gauss(0, cfg["vol"] * 1.5))
                    candles.append({
                        "time":  int(ts.timestamp()),
                        "open":  round(open_p,  5),
                        "high":  round(high_p,  5),
                        "low":   round(low_p,   5),
                        "close": round(close_p, 5),
                    })
                    p = close_p
                self.candles[sym][tf_name] = candles
            self.mids[sym] = p  # last close as current mid

    def tick(self) -> dict:
        """1 tick 進める。現在レート dict を返す"""
        now = datetime.now(timezone.utc)
        rates: dict = {}
        for sym, cfg in SYMBOLS.items():
            change = random.gauss(0, cfg["vol"])
            self.mids[sym] = round(self.mids[sym] + change, 5)
            mid    = self.mids[sym]
            bid    = round(mid - cfg["spread"] / 2, 5)
            ask    = round(mid + cfg["spread"] / 2, 5)
            rates[sym] = {"bid": bid, "ask": ask, "mid": mid, "spread": cfg["spread"]}

            # 1分足の更新
            candle1m = self.candles[sym]["1m"]
            ts_1m = int(now.timestamp() // 60 * 60)
            if candle1m and candle1m[-1]["time"] == ts_1m:
                c = candle1m[-1]
                c["high"]  = max(c["high"],  mid)
                c["low"]   = min(c["low"],   mid)
                c["close"] = mid
            else:
                candle1m.append({"time": ts_1m, "open": mid, "high": mid, "low": mid, "close": mid})
                if len(candle1m) > 500: candle1m.pop(0)
        return rates

    def get_rates(self) -> dict:
        rates: dict = {}
        for sym, cfg in SYMBOLS.items():
            mid = self.mids[sym]
            rates[sym] = {
                "bid": round(mid - cfg["spread"] / 2, 5),
                "ask": round(mid + cfg["spread"] / 2, 5),
                "mid": mid,
                "spread": cfg["spread"],
            }
        return rates

    def get_history(self, symbol: str, timeframe: str) -> list:
        return self.candles.get(symbol, {}).get(timeframe, [])

rate_engine = RateEngine()

# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Manager
# ─────────────────────────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.connections: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.add(ws)

    def disconnect(self, ws: WebSocket):
        self.connections.discard(ws)

    async def broadcast(self, data: dict):
        dead: set = set()
        msg = json.dumps(data)
        for ws in self.connections:
            try: await ws.send_text(msg)
            except Exception: dead.add(ws)
        self.connections -= dead

ws_manager = ConnectionManager()

# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────
pwd_ctx  = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2   = OAuth2PasswordBearer(tokenUrl="/auth/login")

def hash_pw(pw: str) -> str:    return pwd_ctx.hash(pw)
def verify_pw(pw: str, hashed: str) -> bool: return pwd_ctx.verify(pw, hashed)

def create_token(data: dict) -> str:
    payload = {**data, "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_H)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid: str = payload.get("sub")
        if uid is None: raise exc
    except JWTError: raise exc
    user = db.get(User, uid)
    if user is None: raise exc
    return user

# ─────────────────────────────────────────────────────────────────────────────
# Business Logic Helpers
# ─────────────────────────────────────────────────────────────────────────────
def calc_pnl(pos: Position, exit_price: float) -> float:
    """円建て損益計算"""
    units = pos.lot_size * LOTS_PER_UNIT
    cfg   = SYMBOLS.get(pos.symbol, {})
    pip   = cfg.get("pip", 0.01)
    if pos.side == Side.BUY:
        diff = exit_price - pos.entry_price
    else:
        diff = pos.entry_price - exit_price
    if pos.symbol.endswith("JPY"):
        return round(diff * units, 2)
    else:
        # USD建てペアは entry_price 近辺の USD/JPY で換算（簡略: 150固定）
        usdjpy = rate_engine.mids.get("USDJPY", 150.0)
        return round(diff * units * usdjpy, 2)

def calc_margin(symbol: str, lot_size: float, leverage: int, price: float) -> float:
    units = lot_size * LOTS_PER_UNIT
    if symbol.endswith("JPY"):
        return round(units * price / leverage, 2)
    else:
        usdjpy = rate_engine.mids.get("USDJPY", 150.0)
        return round(units * price * usdjpy / leverage, 2)

def calc_slippage(symbol: str) -> float:
    """スリッページ(pips)"""
    pip = SYMBOLS[symbol]["pip"]
    base = max(0.0, random.gauss(0.5, 0.5))
    return round(min(base, 3.0), 3)

def apply_slippage(symbol: str, side: Side, price: float, slippage_pips: float) -> float:
    pip   = SYMBOLS[symbol]["pip"]
    delta = slippage_pips * pip
    return round(price + delta if side == Side.BUY else price - delta, 5)

def get_fill_price(symbol: str, side: Side, apply_slip: bool = True) -> tuple[float, float]:
    """(filled_price, slippage_pips)"""
    rates = rate_engine.get_rates()[symbol]
    raw   = rates["ask"] if side == Side.BUY else rates["bid"]
    if not apply_slip:
        return raw, 0.0
    slip  = calc_slippage(symbol)
    fp    = apply_slippage(symbol, side, raw, slip)
    return fp, slip

def fill_order_and_create_position(order: Order, filled_price: float, slippage_pips: float, db: Session):
    """注文を約定させてポジションを生成（トランザクション内で呼ぶ）"""
    margin = calc_margin(order.symbol, order.lot_size, order.leverage, filled_price)
    now    = datetime.now(timezone.utc)

    order.status       = OrderStatus.FILLED
    order.filled_price = filled_price
    order.slippage_pips = slippage_pips
    order.filled_at    = now

    pos = Position(
        user_id         = order.user_id,
        order_id        = order.id,
        symbol          = order.symbol,
        side            = order.side,
        lot_size        = order.lot_size,
        leverage        = order.leverage,
        entry_price     = filled_price,
        sl_price        = order.sl_price,
        tp_price        = order.tp_price,
        required_margin = margin,
    )
    db.add(pos)

    # 証拠金を口座から拘束
    acct = db.query(VirtualAccount).filter_by(user_id=order.user_id).first()
    if acct: acct.balance -= margin

    db.commit()
    return pos

def close_position(pos: Position, exit_price: float, reason: CloseReason, db: Session) -> Trade:
    now    = datetime.now(timezone.utc)
    pnl    = calc_pnl(pos, exit_price)
    pip    = SYMBOLS[pos.symbol]["pip"]
    pips   = round((exit_price - pos.entry_price) / pip if pos.side == Side.BUY
                   else (pos.entry_price - exit_price) / pip, 1)
    dur    = int((now - pos.opened_at.replace(tzinfo=timezone.utc)).total_seconds())

    pos.status    = PositionStatus.CLOSED
    pos.closed_at = now

    # 証拠金 + 損益を残高に戻す
    acct = db.query(VirtualAccount).filter_by(user_id=pos.user_id).first()
    if acct: acct.balance += pos.required_margin + pnl

    trade = Trade(
        user_id              = pos.user_id,
        position_id          = pos.id,
        symbol               = pos.symbol,
        side                 = pos.side,
        lot_size             = pos.lot_size,
        leverage             = pos.leverage,
        entry_price          = pos.entry_price,
        exit_price           = exit_price,
        net_pnl              = pnl,
        pips_gained          = pips,
        holding_duration_sec = dur,
        close_reason         = reason,
        opened_at            = pos.opened_at,
        closed_at            = now,
    )
    db.add(trade)
    db.commit()
    return trade

# ─────────────────────────────────────────────────────────────────────────────
# Background Tasks
# ─────────────────────────────────────────────────────────────────────────────
async def rate_broadcast_loop():
    """1秒ごとにレートを生成してWS配信"""
    while True:
        await asyncio.sleep(1)
        rates = rate_engine.tick()
        await ws_manager.broadcast({"type": "rate.update", "data": rates})

async def order_engine_loop():
    """2秒ごとにOPEN注文をチェックして約定処理"""
    while True:
        await asyncio.sleep(2)
        rates = rate_engine.get_rates()
        db    = SessionLocal()
        try:
            open_orders = db.query(Order).filter(Order.status == OrderStatus.OPEN).all()
            for order in open_orders:
                if order.symbol not in rates: continue
                rate = rates[order.symbol]
                filled = False
                if order.type == OrderType.LIMIT:
                    if order.limit_price and order.side == Side.BUY  and rate["ask"] <= order.limit_price:
                        fp, slip = order.limit_price, 0.0; filled = True
                    elif order.limit_price and order.side == Side.SELL and rate["bid"] >= order.limit_price:
                        fp, slip = order.limit_price, 0.0; filled = True
                elif order.type == OrderType.STOP:
                    if order.stop_price and order.side == Side.BUY  and rate["ask"] >= order.stop_price:
                        fp, slip = get_fill_price(order.symbol, order.side)
                        filled = True
                    elif order.stop_price and order.side == Side.SELL and rate["bid"] <= order.stop_price:
                        fp, slip = get_fill_price(order.symbol, order.side)
                        filled = True
                elif order.type in (OrderType.OCO, OrderType.IFD, OrderType.IFO):
                    # limit leg
                    if order.limit_price and order.side == Side.BUY  and rate["ask"] <= order.limit_price:
                        fp, slip = order.limit_price, 0.0; filled = True
                    elif order.limit_price and order.side == Side.SELL and rate["bid"] >= order.limit_price:
                        fp, slip = order.limit_price, 0.0; filled = True
                    # stop leg
                    elif order.stop_price and order.side == Side.BUY  and rate["ask"] >= order.stop_price:
                        fp, slip = get_fill_price(order.symbol, order.side); filled = True
                    elif order.stop_price and order.side == Side.SELL and rate["bid"] <= order.stop_price:
                        fp, slip = get_fill_price(order.symbol, order.side); filled = True

                if filled:
                    pos = fill_order_and_create_position(order, fp, slip, db)
                    # OCO/IFO: cancel/update linked orders
                    if order.linked_order_id:
                        linked = db.get(Order, order.linked_order_id)
                        if linked and linked.status == OrderStatus.OPEN:
                            if order.type == OrderType.OCO:
                                # OCO: cancel linked order
                                linked.status = OrderStatus.CANCELLED
                                linked.cancelled_at = datetime.now(timezone.utc)
                            elif order.type == OrderType.IFO:
                                # IFO: linked order is still PENDING, keep it
                                pass
                            db.commit()
                    # IFD/IFO: activate pending child orders
                    if order.type in (OrderType.IFD, OrderType.IFO):
                        child_orders = db.query(Order).filter(
                            Order.parent_order_id == order.id, Order.status == OrderStatus.PENDING).all()
                        for child in child_orders:
                            child.status = OrderStatus.OPEN
                        if child_orders:
                            db.commit()
                    await ws_manager.broadcast({"type": "order.filled",
                        "data": {"order_id": order.id, "filled_price": fp, "slippage_pips": slip}})

            # SL/TP & ロスカット確認
            users_with_pos = db.query(Position.user_id).filter(
                Position.status == PositionStatus.OPEN).distinct().all()
            for (uid,) in users_with_pos:
                positions = db.query(Position).filter(
                    Position.user_id == uid, Position.status == PositionStatus.OPEN).all()
                acct = db.query(VirtualAccount).filter_by(user_id=uid).first()
                if not acct: continue

                total_pnl    = sum(calc_pnl(p, rates[p.symbol]["bid"] if p.side == Side.BUY
                                             else rates[p.symbol]["ask"]) for p in positions if p.symbol in rates)
                equity       = acct.balance + total_pnl
                total_margin = sum(p.required_margin for p in positions)
                margin_level = equity / total_margin if total_margin > 0 else 999.0

                for pos in positions:
                    if pos.symbol not in rates: continue
                    exit_bid = rates[pos.symbol]["bid"]
                    exit_ask = rates[pos.symbol]["ask"]

                    # TP
                    if pos.tp_price:
                        if pos.side == Side.BUY  and exit_bid >= pos.tp_price:
                            close_position(pos, pos.tp_price, CloseReason.TP, db)
                            await ws_manager.broadcast({"type": "position.closed", "data": {"position_id": pos.id, "reason": "tp"}})
                            continue
                        elif pos.side == Side.SELL and exit_ask <= pos.tp_price:
                            close_position(pos, pos.tp_price, CloseReason.TP, db)
                            await ws_manager.broadcast({"type": "position.closed", "data": {"position_id": pos.id, "reason": "tp"}})
                            continue
                    # SL
                    if pos.sl_price:
                        if pos.side == Side.BUY  and exit_bid <= pos.sl_price:
                            close_position(pos, pos.sl_price, CloseReason.SL, db)
                            await ws_manager.broadcast({"type": "position.closed", "data": {"position_id": pos.id, "reason": "sl"}})
                            continue
                        elif pos.side == Side.SELL and exit_ask >= pos.sl_price:
                            close_position(pos, pos.sl_price, CloseReason.SL, db)
                            await ws_manager.broadcast({"type": "position.closed", "data": {"position_id": pos.id, "reason": "sl"}})
                            continue
                # ロスカット
                if margin_level < LOSS_CUT_LEVEL:
                    for pos in positions:
                        if pos.status == PositionStatus.OPEN and pos.symbol in rates:
                            ep = rates[pos.symbol]["bid"] if pos.side == Side.BUY else rates[pos.symbol]["ask"]
                            close_position(pos, ep, CloseReason.LOSS_CUT, db)
                    await ws_manager.broadcast({"type": "position.loss_cut", "data": {"user_id": uid}})
                # 証拠金維持率警告 (100%-200%)
                elif 1.0 <= margin_level < 2.0:
                    await ws_manager.broadcast({"type": "margin.warning",
                        "data": {"user_id": uid, "margin_level": round(margin_level, 4)}})
        finally:
            db.close()

# ─────────────────────────────────────────────────────────────────────────────
# App Lifecycle
# ─────────────────────────────────────────────────────────────────────────────
def _run_migrations():
    """既存DBに不足カラムをALTER TABLEで追加するマイグレーション"""
    with engine.connect() as conn:
        # ordersテーブルの現在のカラム一覧を取得
        result = conn.execute(__import__('sqlalchemy').text("PRAGMA table_info(orders)"))
        existing_cols = {row[1] for row in result.fetchall()}

        migrations = [
            ("linked_order_id", "ALTER TABLE orders ADD COLUMN linked_order_id VARCHAR"),
            ("parent_order_id", "ALTER TABLE orders ADD COLUMN parent_order_id VARCHAR"),
        ]
        for col_name, sql in migrations:
            if col_name not in existing_cols:
                conn.execute(__import__('sqlalchemy').text(sql))
        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    # 経済指標モックデータ投入
    db = SessionLocal()
    try:
        _seed_economic_events(db)
    finally:
        db.close()
    asyncio.create_task(rate_broadcast_loop())
    asyncio.create_task(order_engine_loop())
    yield

app = FastAPI(title="FX Practice API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: str; username: str; password: str

class TokenOut(BaseModel):
    access_token: str; token_type: str = "bearer"

class OrderIn(BaseModel):
    type: OrderType
    side: Side
    symbol: str
    lot_size: float
    leverage: int = 25
    limit_price:  Optional[float] = None
    stop_price:   Optional[float] = None
    sl_price:     Optional[float] = None
    tp_price:     Optional[float] = None

class CloseIn(BaseModel):
    position_id: str

# ─────────────────────────────────────────────────────────────────────────────
# Auth Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/auth/register", response_model=TokenOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=body.email).first():
        raise HTTPException(400, "Email already registered")
    user = User(email=body.email, username=body.username, password_hash=hash_pw(body.password))
    db.add(user)
    db.flush()
    db.add(VirtualAccount(user_id=user.id))
    db.commit()
    return TokenOut(access_token=create_token({"sub": user.id}))

@app.post("/auth/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=form.username).first()
    if not user or not verify_pw(form.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return TokenOut(access_token=create_token({"sub": user.id}))

# ─────────────────────────────────────────────────────────────────────────────
# Account Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/account")
def get_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    acct   = user.account
    rates  = rate_engine.get_rates()
    positions = db.query(Position).filter_by(user_id=user.id, status=PositionStatus.OPEN).all()
    total_unrealized = sum(
        calc_pnl(p, rates[p.symbol]["bid"] if p.side == Side.BUY else rates[p.symbol]["ask"])
        for p in positions if p.symbol in rates
    )
    total_margin = sum(p.required_margin for p in positions)
    equity       = acct.balance + total_unrealized
    margin_level = equity / total_margin * 100 if total_margin > 0 else 9999.0
    return {
        "id": user.id, "email": user.email, "username": user.username,
        "balance":         round(acct.balance, 2),
        "initial_balance": acct.initial_balance,
        "equity":          round(equity, 2),
        "unrealized_pnl":  round(total_unrealized, 2),
        "required_margin": round(total_margin, 2),
        "margin_level":    round(margin_level, 2),
    }

@app.post("/account/reset")
def reset_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 全オープンポジションをロスカット
    positions = db.query(Position).filter_by(user_id=user.id, status=PositionStatus.OPEN).all()
    rates = rate_engine.get_rates()
    for pos in positions:
        if pos.symbol in rates:
            ep = rates[pos.symbol]["bid"] if pos.side == Side.BUY else rates[pos.symbol]["ask"]
            close_position(pos, ep, CloseReason.LOSS_CUT, db)
    # 全未約定注文をキャンセル
    db.query(Order).filter_by(user_id=user.id).filter(
        Order.status.in_([OrderStatus.PENDING, OrderStatus.OPEN])
    ).update({"status": OrderStatus.CANCELLED, "cancelled_at": datetime.now(timezone.utc)})
    # 残高リセット
    user.account.balance = user.account.initial_balance
    db.commit()
    return {"message": "Account reset"}

# ─────────────────────────────────────────────────────────────────────────────
# Rate Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/rates")
def get_rates():
    return rate_engine.get_rates()

@app.get("/rates/{symbol}/history")
def get_history(symbol: str, timeframe: str = "1m"):
    candles = rate_engine.get_history(symbol, timeframe)
    return {"symbol": symbol, "timeframe": timeframe, "candles": candles}

# ─────────────────────────────────────────────────────────────────────────────
# Order Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/orders")
def create_order(body: OrderIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.symbol not in SYMBOLS:
        raise HTTPException(400, f"Unknown symbol: {body.symbol}")
    if body.lot_size <= 0 or body.lot_size > 100:
        raise HTTPException(400, "lot_size must be between 0.01 and 100")

    # 証拠金チェック
    rates  = rate_engine.get_rates()
    price  = rates[body.symbol]["ask"] if body.side == Side.BUY else rates[body.symbol]["bid"]
    target_price = body.limit_price or body.stop_price or price
    margin = calc_margin(body.symbol, body.lot_size, body.leverage, target_price)
    acct   = user.account
    if acct.balance < margin:
        raise HTTPException(400, f"Insufficient margin. Required: ¥{margin:,.0f}, Available: ¥{acct.balance:,.0f}")

    order = Order(
        user_id     = user.id,
        type        = body.type,
        side        = body.side,
        symbol      = body.symbol,
        lot_size    = body.lot_size,
        leverage    = body.leverage,
        limit_price = body.limit_price,
        stop_price  = body.stop_price,
        sl_price    = body.sl_price,
        tp_price    = body.tp_price,
    )

    if body.type == OrderType.MARKET:
        fp, slip = get_fill_price(body.symbol, body.side)
        order.status = OrderStatus.PENDING
        db.add(order)
        db.flush()
        fill_order_and_create_position(order, fp, slip, db)
        return {"order_id": order.id, "filled_price": fp, "slippage_pips": slip, "status": "filled"}
    elif body.type == OrderType.OCO:
        order.status = OrderStatus.OPEN
        # OCO: 2つの注文を linked で作成
        order2 = Order(
            user_id=user.id, type=OrderType.OCO, side=body.side, symbol=body.symbol,
            lot_size=body.lot_size, leverage=body.leverage,
            limit_price=body.limit_price, stop_price=body.stop_price,
            sl_price=body.sl_price, tp_price=body.tp_price,
            status=OrderStatus.OPEN,
        )
        db.add(order); db.add(order2); db.flush()
        order.linked_order_id  = order2.id
        order2.linked_order_id = order.id
        db.commit()
        return {"order_id": order.id, "status": "open"}
    elif body.type == OrderType.IFD:
        # IFD: エントリー注文(OPEN) + 決済注文(PENDING, parent_order_id設定)
        # 決済注文にはsl_priceなし、tp_priceが決済指値価格
        order.status = OrderStatus.OPEN
        db.add(order)
        db.flush()
        entry_order_id = order.id

        # 決済注文を作成（逆方向、PENDING）
        exit_side = Side.SELL if body.side == Side.BUY else Side.BUY
        close_order = Order(
            user_id=user.id, type=OrderType.LIMIT, side=exit_side, symbol=body.symbol,
            lot_size=body.lot_size, leverage=body.leverage,
            limit_price=body.tp_price,  # tp_priceが決済指値
            status=OrderStatus.PENDING,
            parent_order_id=entry_order_id,
        )
        db.add(close_order)
        db.commit()
        return {"order_id": order.id, "status": "open", "close_order_id": close_order.id}
    elif body.type == OrderType.IFO:
        # IFO: エントリー注文(OPEN) + SL注文(PENDING) + TP注文(PENDING, linked)
        order.status = OrderStatus.OPEN
        db.add(order)
        db.flush()
        entry_order_id = order.id

        # SL注文を作成（逆方向、PENDING）
        exit_side = Side.SELL if body.side == Side.BUY else Side.BUY
        sl_order = Order(
            user_id=user.id, type=OrderType.STOP, side=exit_side, symbol=body.symbol,
            lot_size=body.lot_size, leverage=body.leverage,
            stop_price=body.sl_price,
            status=OrderStatus.PENDING,
            parent_order_id=entry_order_id,
        )
        # TP注文を作成（逆方向、PENDING）
        tp_order = Order(
            user_id=user.id, type=OrderType.LIMIT, side=exit_side, symbol=body.symbol,
            lot_size=body.lot_size, leverage=body.leverage,
            limit_price=body.tp_price,
            status=OrderStatus.PENDING,
            parent_order_id=entry_order_id,
        )
        db.add(sl_order); db.add(tp_order); db.flush()
        sl_order.linked_order_id = tp_order.id
        tp_order.linked_order_id = sl_order.id
        db.commit()
        return {"order_id": order.id, "status": "open", "sl_order_id": sl_order.id, "tp_order_id": tp_order.id}
    else:
        order.status = OrderStatus.OPEN
        db.add(order)
        db.commit()
        return {"order_id": order.id, "status": "open"}

@app.get("/orders")
def list_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(Order).filter_by(user_id=user.id).order_by(Order.created_at.desc()).limit(50).all()
    return [{"id": o.id, "type": o.type, "side": o.side, "symbol": o.symbol,
             "lot_size": o.lot_size, "leverage": o.leverage,
             "limit_price": o.limit_price, "stop_price": o.stop_price,
             "sl_price": o.sl_price, "tp_price": o.tp_price,
             "status": o.status, "filled_price": o.filled_price,
             "slippage_pips": o.slippage_pips,
             "linked_order_id": o.linked_order_id,
             "parent_order_id": o.parent_order_id,
             "created_at": o.created_at.isoformat()} for o in orders]

@app.delete("/orders/{order_id}")
def cancel_order(order_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order or order.user_id != user.id:
        raise HTTPException(404, "Order not found")
    if order.status not in (OrderStatus.PENDING, OrderStatus.OPEN):
        raise HTTPException(400, "Cannot cancel this order")
    order.status = OrderStatus.CANCELLED
    order.cancelled_at = datetime.now(timezone.utc)
    if order.linked_order_id:
        linked = db.get(Order, order.linked_order_id)
        if linked: linked.status = OrderStatus.CANCELLED; linked.cancelled_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Cancelled"}

# ─────────────────────────────────────────────────────────────────────────────
# Position Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/positions")
def list_positions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    positions = db.query(Position).filter_by(user_id=user.id, status=PositionStatus.OPEN).all()
    rates     = rate_engine.get_rates()
    result = []
    for pos in positions:
        r    = rates.get(pos.symbol, {})
        ep   = r.get("bid", pos.entry_price) if pos.side == Side.BUY else r.get("ask", pos.entry_price)
        pnl  = calc_pnl(pos, ep)
        pip  = SYMBOLS[pos.symbol]["pip"]
        pips = round((ep - pos.entry_price) / pip if pos.side == Side.BUY
                     else (pos.entry_price - ep) / pip, 1)
        result.append({
            "id": pos.id, "symbol": pos.symbol, "side": pos.side,
            "lot_size": pos.lot_size, "leverage": pos.leverage,
            "entry_price": pos.entry_price, "current_price": ep,
            "sl_price": pos.sl_price, "tp_price": pos.tp_price,
            "unrealized_pnl": pnl, "pips": pips,
            "required_margin": pos.required_margin,
            "opened_at": pos.opened_at.isoformat(),
        })
    return result

@app.post("/positions/{position_id}/close")
def close_pos(position_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pos = db.get(Position, position_id)
    if not pos or pos.user_id != user.id:
        raise HTTPException(404, "Position not found")
    if pos.status != PositionStatus.OPEN:
        raise HTTPException(400, "Already closed")
    rates = rate_engine.get_rates()
    ep    = rates[pos.symbol]["bid"] if pos.side == Side.BUY else rates[pos.symbol]["ask"]
    trade = close_position(pos, ep, CloseReason.MANUAL, db)
    return {"trade_id": trade.id, "exit_price": ep, "net_pnl": trade.net_pnl}

@app.patch("/positions/{position_id}/sl-tp")
def update_position_sl_tp(position_id: str, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pos = db.get(Position, position_id)
    if not pos or pos.user_id != user.id:
        raise HTTPException(404, "Position not found")
    if pos.status != PositionStatus.OPEN:
        raise HTTPException(400, "Position is not open")

    if "sl_price" in body:
        pos.sl_price = body["sl_price"]
    if "tp_price" in body:
        pos.tp_price = body["tp_price"]
    db.commit()
    return {"message": "SL/TP updated", "position_id": pos.id, "sl_price": pos.sl_price, "tp_price": pos.tp_price}

@app.post("/positions/close-all")
def close_all_positions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    positions = db.query(Position).filter_by(user_id=user.id, status=PositionStatus.OPEN).all()
    if not positions:
        return {"message": "No open positions to close", "closed_count": 0, "total_net_pnl": 0.0}

    rates = rate_engine.get_rates()
    total_pnl = 0.0
    for pos in positions:
        if pos.symbol in rates:
            ep = rates[pos.symbol]["bid"] if pos.side == Side.BUY else rates[pos.symbol]["ask"]
            trade = close_position(pos, ep, CloseReason.MANUAL, db)
            total_pnl += trade.net_pnl

    return {"message": "All positions closed", "closed_count": len(positions), "total_net_pnl": round(total_pnl, 2)}

# ─────────────────────────────────────────────────────────────────────────────
# Stats Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/trades")
def list_trades(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trades = db.query(Trade).filter_by(user_id=user.id).order_by(Trade.closed_at.desc()).limit(200).all()
    return [{"id": t.id, "symbol": t.symbol, "side": t.side,
             "lot_size": t.lot_size, "leverage": t.leverage,
             "entry_price": t.entry_price, "exit_price": t.exit_price,
             "net_pnl": t.net_pnl, "pips_gained": t.pips_gained,
             "holding_duration_sec": t.holding_duration_sec,
             "close_reason": t.close_reason, "slippage_pips": t.slippage_pips,
             "opened_at": t.opened_at.isoformat(), "closed_at": t.closed_at.isoformat()} for t in trades]

@app.get("/stats/summary")
def stats_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trades = db.query(Trade).filter_by(user_id=user.id).all()
    if not trades:
        return {"total_trades": 0, "win_rate": 0, "roi": 0, "profit_factor": 0,
                "total_pnl_jpy": 0, "expected_value_jpy": 0, "max_drawdown": 0, "average_rr": 0}

    total    = len(trades)
    wins     = [t for t in trades if t.net_pnl > 0]
    losses   = [t for t in trades if t.net_pnl <= 0]
    win_rate = len(wins) / total
    total_pnl = sum(t.net_pnl for t in trades)
    gross_profit = sum(t.net_pnl for t in wins)
    gross_loss   = abs(sum(t.net_pnl for t in losses))
    avg_profit   = gross_profit / len(wins)   if wins   else 0
    avg_loss     = abs(sum(t.net_pnl for t in losses) / len(losses)) if losses else 0
    pf           = gross_profit / gross_loss if gross_loss > 0 else float("inf")
    ev           = win_rate * avg_profit - (1 - win_rate) * avg_loss
    rr           = avg_profit / avg_loss if avg_loss > 0 else 0
    initial      = user.account.initial_balance
    roi          = total_pnl / initial if initial > 0 else 0

    # 最大ドローダウン
    sorted_trades = sorted(trades, key=lambda t: t.closed_at)
    balance = initial; peak = initial; max_dd = 0.0
    for t in sorted_trades:
        balance += t.net_pnl
        peak     = max(peak, balance)
        dd       = (balance - peak) / peak if peak > 0 else 0
        max_dd   = min(max_dd, dd)

    return {
        "total_trades":      total,
        "win_count":         len(wins),
        "loss_count":        len(losses),
        "win_rate":          round(win_rate, 4),
        "total_pnl_jpy":     round(total_pnl, 2),
        "roi":               round(roi, 4),
        "profit_factor":     round(pf, 2) if pf != float("inf") else None,
        "max_drawdown":      round(max_dd, 4),
        "expected_value_jpy": round(ev, 0),
        "average_rr":        round(rr, 2),
    }

@app.get("/stats/monthly")
def stats_monthly(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """月次パフォーマンス一覧（JST月次集計）"""
    trades = db.query(Trade).filter_by(user_id=user.id).order_by(Trade.closed_at).all()
    if not trades:
        return []

    from collections import defaultdict
    JST = timezone(timedelta(hours=9))
    monthly: dict = defaultdict(list)
    for t in trades:
        jst_dt = t.closed_at.replace(tzinfo=timezone.utc).astimezone(JST)
        key = jst_dt.strftime("%Y-%m")
        monthly[key].append(t)

    result = []
    initial = user.account.initial_balance
    for month, month_trades in sorted(monthly.items()):
        wins   = [t for t in month_trades if t.net_pnl > 0]
        losses = [t for t in month_trades if t.net_pnl <= 0]
        total_pnl = sum(t.net_pnl for t in month_trades)
        gross_profit = sum(t.net_pnl for t in wins)
        gross_loss   = abs(sum(t.net_pnl for t in losses))
        pf = round(gross_profit / gross_loss, 2) if gross_loss > 0 else None
        result.append({
            "month":         month,
            "total_trades":  len(month_trades),
            "win_count":     len(wins),
            "loss_count":    len(losses),
            "win_rate":      round(len(wins) / len(month_trades), 4),
            "total_pnl_jpy": round(total_pnl, 2),
            "gross_profit":  round(gross_profit, 2),
            "gross_loss":    round(gross_loss, 2),
            "profit_factor": pf,
            "roi":           round(total_pnl / initial, 4) if initial > 0 else 0,
        })
    return result

@app.get("/stats/weekly")
def stats_weekly(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """週次パフォーマンス一覧（JST週次集計）"""
    trades = db.query(Trade).filter_by(user_id=user.id).order_by(Trade.closed_at).all()
    if not trades:
        return []

    from collections import defaultdict
    JST = timezone(timedelta(hours=9))
    weekly: dict = defaultdict(list)
    for t in trades:
        jst_dt = t.closed_at.replace(tzinfo=timezone.utc).astimezone(JST)
        # ISO week (YYYY-Www)
        key = jst_dt.strftime("%Y-W%V")
        weekly[key].append(t)

    result = []
    initial = user.account.initial_balance
    for week, week_trades in sorted(weekly.items()):
        wins      = [t for t in week_trades if t.net_pnl > 0]
        losses    = [t for t in week_trades if t.net_pnl <= 0]
        total_pnl = sum(t.net_pnl for t in week_trades)
        gross_profit = sum(t.net_pnl for t in wins)
        gross_loss   = abs(sum(t.net_pnl for t in losses))
        pf = round(gross_profit / gross_loss, 2) if gross_loss > 0 else None
        result.append({
            "week":          week,
            "total_trades":  len(week_trades),
            "win_count":     len(wins),
            "loss_count":    len(losses),
            "win_rate":      round(len(wins) / len(week_trades), 4),
            "total_pnl_jpy": round(total_pnl, 2),
            "profit_factor": pf,
            "roi":           round(total_pnl / initial, 4) if initial > 0 else 0,
        })
    return result

@app.get("/stats/by-symbol")
def stats_by_symbol(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """通貨ペア別成績"""
    trades = db.query(Trade).filter_by(user_id=user.id).all()
    if not trades:
        return []

    from collections import defaultdict
    by_sym: dict = defaultdict(list)
    for t in trades:
        by_sym[t.symbol].append(t)

    result = []
    initial = user.account.initial_balance
    for sym, sym_trades in sorted(by_sym.items()):
        wins         = [t for t in sym_trades if t.net_pnl > 0]
        losses       = [t for t in sym_trades if t.net_pnl <= 0]
        total_pnl    = sum(t.net_pnl for t in sym_trades)
        gross_profit = sum(t.net_pnl for t in wins)
        gross_loss   = abs(sum(t.net_pnl for t in losses))
        avg_holding  = sum(t.holding_duration_sec for t in sym_trades) / len(sym_trades)
        pf = round(gross_profit / gross_loss, 2) if gross_loss > 0 else None
        result.append({
            "symbol":        sym,
            "total_trades":  len(sym_trades),
            "win_count":     len(wins),
            "loss_count":    len(losses),
            "win_rate":      round(len(wins) / len(sym_trades), 4),
            "total_pnl_jpy": round(total_pnl, 2),
            "gross_profit":  round(gross_profit, 2),
            "gross_loss":    round(gross_loss, 2),
            "profit_factor": pf,
            "avg_holding_sec": int(avg_holding),
        })
    return result

@app.get("/trades/export")
def export_trades_csv(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """確定済みトレード履歴をCSV形式でエクスポート"""
    import io, csv
    from fastapi.responses import StreamingResponse

    trades = db.query(Trade).filter_by(user_id=user.id).order_by(Trade.closed_at.desc()).all()
    JST = timezone(timedelta(hours=9))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "symbol", "side", "lot_size", "leverage",
        "entry_price", "exit_price", "net_pnl", "pips_gained",
        "holding_duration_sec", "close_reason", "slippage_pips",
        "opened_at_jst", "closed_at_jst"
    ])
    for t in trades:
        opened_jst = t.opened_at.replace(tzinfo=timezone.utc).astimezone(JST).strftime("%Y/%m/%d %H:%M:%S")
        closed_jst = t.closed_at.replace(tzinfo=timezone.utc).astimezone(JST).strftime("%Y/%m/%d %H:%M:%S")
        writer.writerow([
            t.id, t.symbol, t.side.value, t.lot_size, t.leverage,
            t.entry_price, t.exit_price, round(t.net_pnl, 2), t.pips_gained,
            t.holding_duration_sec, t.close_reason.value, t.slippage_pips,
            opened_jst, closed_jst
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trades.csv"}
    )

# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Endpoint
# ─────────────────────────────────────────────────────────────────────────────
# Economic Events (経済指標カレンダー)
# ─────────────────────────────────────────────────────────────────────────────
class EventImportance(str, enum.Enum):
    LOW = "low"; MEDIUM = "medium"; HIGH = "high"

class EconomicEvent(Base):
    __tablename__ = "economic_events"
    id           = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title        = Column(String, nullable=False)
    country      = Column(String, nullable=False)
    currency     = Column(String, nullable=False)
    importance   = Column(SAEnum(EventImportance), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    forecast     = Column(String, nullable=True)
    previous     = Column(String, nullable=True)
    actual       = Column(String, nullable=True)
    description  = Column(String, nullable=True)

def _seed_economic_events(db: Session):
    """モックの経済指標データを投入（初回のみ）"""
    if db.query(EconomicEvent).count() > 0:
        return
    from datetime import date
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    events = [
        # 今週の主要指標（モック）
        {"title": "米 非農業部門雇用者数 (NFP)", "country": "US", "currency": "USD",
         "importance": EventImportance.HIGH,
         "scheduled_at": today + timedelta(days=1, hours=21, minutes=30),
         "forecast": "200K", "previous": "187K",
         "description": "米国の雇用統計。毎月第1金曜日に発表。USD相場に最大の影響を与える指標。"},
        {"title": "米 消費者物価指数 (CPI)", "country": "US", "currency": "USD",
         "importance": EventImportance.HIGH,
         "scheduled_at": today + timedelta(days=2, hours=21, minutes=30),
         "forecast": "3.2%", "previous": "3.1%",
         "description": "インフレ動向を示す指標。FRBの利上げ判断に直結。"},
        {"title": "日銀 金融政策決定会合", "country": "JP", "currency": "JPY",
         "importance": EventImportance.HIGH,
         "scheduled_at": today + timedelta(days=3, hours=3, minutes=0),
         "forecast": "-", "previous": "0.1%",
         "description": "日本銀行が政策金利を決定する会合。JPYの方向性を左右する。"},
        {"title": "欧 ECB政策金利", "country": "EU", "currency": "EUR",
         "importance": EventImportance.HIGH,
         "scheduled_at": today + timedelta(days=4, hours=13, minutes=15),
         "forecast": "4.50%", "previous": "4.50%",
         "description": "欧州中央銀行の政策金利発表。EUR/USD に大きな影響。"},
        {"title": "米 GDP (速報値)", "country": "US", "currency": "USD",
         "importance": EventImportance.MEDIUM,
         "scheduled_at": today + timedelta(days=5, hours=13, minutes=30),
         "forecast": "2.5%", "previous": "3.1%",
         "description": "米国の国内総生産成長率。四半期に一度発表。"},
        {"title": "英 消費者物価指数", "country": "UK", "currency": "GBP",
         "importance": EventImportance.MEDIUM,
         "scheduled_at": today + timedelta(days=2, hours=9, minutes=0),
         "forecast": "4.0%", "previous": "4.2%",
         "description": "英国のインフレ指標。BOEの利上げ判断に影響。"},
        {"title": "日 全国消費者物価指数", "country": "JP", "currency": "JPY",
         "importance": EventImportance.MEDIUM,
         "scheduled_at": today + timedelta(days=0, hours=23, minutes=30),
         "forecast": "2.8%", "previous": "2.6%",
         "description": "日本のインフレ率。日銀の政策判断に影響を与える。"},
        {"title": "豪 RBA政策金利", "country": "AU", "currency": "AUD",
         "importance": EventImportance.HIGH,
         "scheduled_at": today + timedelta(days=1, hours=3, minutes=30),
         "forecast": "4.35%", "previous": "4.35%",
         "description": "オーストラリア準備銀行の政策金利。AUD/JPYに影響。"},
        {"title": "米 ISM製造業景況指数", "country": "US", "currency": "USD",
         "importance": EventImportance.MEDIUM,
         "scheduled_at": today + timedelta(days=3, hours=15, minutes=0),
         "forecast": "50.5", "previous": "49.8",
         "description": "製造業の景況感を示す指標。50以上で景気拡大。"},
        {"title": "米 小売売上高", "country": "US", "currency": "USD",
         "importance": EventImportance.MEDIUM,
         "scheduled_at": today + timedelta(days=4, hours=21, minutes=30),
         "forecast": "0.4%", "previous": "0.6%",
         "description": "消費動向を示す指標。個人消費はGDPの約70%を占める。"},
        {"title": "日 日銀議事要旨", "country": "JP", "currency": "JPY",
         "importance": EventImportance.LOW,
         "scheduled_at": today + timedelta(days=0, hours=5, minutes=0),
         "forecast": "-", "previous": "-",
         "description": "前回の日銀金融政策決定会合の議事録。"},
        {"title": "米 新規失業保険申請件数", "country": "US", "currency": "USD",
         "importance": EventImportance.LOW,
         "scheduled_at": today + timedelta(days=1, hours=21, minutes=30),
         "forecast": "215K", "previous": "220K",
         "description": "週次の失業保険申請数。労働市場の週次指標。"},
    ]
    for e in events:
        db.add(EconomicEvent(**e))
    db.commit()

@app.get("/economic/events")
def get_economic_events(
    importance: Optional[str] = None,
    country: Optional[str] = None,
    days: int = 7,
    db: Session = Depends(get_db)
):
    """経済指標カレンダー（認証不要・今後days日間のイベント）"""
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=days)
    query = db.query(EconomicEvent).filter(
        EconomicEvent.scheduled_at >= now - timedelta(days=1),
        EconomicEvent.scheduled_at <= end,
    )
    if importance:
        query = query.filter(EconomicEvent.importance == importance)
    if country:
        query = query.filter(EconomicEvent.country == country.upper())

    events = query.order_by(EconomicEvent.scheduled_at).all()
    JST = timezone(timedelta(hours=9))
    return [{
        "id": e.id,
        "title": e.title,
        "country": e.country,
        "currency": e.currency,
        "importance": e.importance,
        "scheduled_at_utc": e.scheduled_at.replace(tzinfo=timezone.utc).isoformat(),
        "scheduled_at_jst": e.scheduled_at.replace(tzinfo=timezone.utc).astimezone(JST).strftime("%Y/%m/%d %H:%M JST"),
        "forecast": e.forecast,
        "previous": e.previous,
        "actual": e.actual,
        "description": e.description,
    } for e in events]

@app.get("/economic/events/{event_id}")
def get_economic_event(event_id: str, db: Session = Depends(get_db)):
    """経済指標詳細"""
    e = db.get(EconomicEvent, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    JST = timezone(timedelta(hours=9))
    return {
        "id": e.id, "title": e.title, "country": e.country, "currency": e.currency,
        "importance": e.importance,
        "scheduled_at_utc": e.scheduled_at.replace(tzinfo=timezone.utc).isoformat(),
        "scheduled_at_jst": e.scheduled_at.replace(tzinfo=timezone.utc).astimezone(JST).strftime("%Y/%m/%d %H:%M JST"),
        "forecast": e.forecast, "previous": e.previous, "actual": e.actual,
        "description": e.description,
    }

# ─────────────────────────────────────────────────────────────────────────────
# Wave Annotations (エリオット波動アノテーション)
# ─────────────────────────────────────────────────────────────────────────────
class WaveAnnotation(Base):
    __tablename__ = "wave_annotations"
    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id    = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    symbol     = Column(String, nullable=False)
    timeframe  = Column(String, nullable=False)
    label      = Column(String, nullable=False)   # 例: "1" "2" "3" "A" "B" "C"
    price      = Column(Float, nullable=False)
    timestamp  = Column(Integer, nullable=False)  # Unix秒（チャート上の時刻）
    color      = Column(String, nullable=True, default="#FFD700")
    note       = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user       = relationship("User")

class AnnotationIn(BaseModel):
    symbol:    str
    timeframe: str
    label:     str
    price:     float
    timestamp: int
    color:     Optional[str] = "#FFD700"
    note:      Optional[str] = None

class AnnotationUpdate(BaseModel):
    label:     Optional[str]   = None
    price:     Optional[float] = None
    color:     Optional[str]   = None
    note:      Optional[str]   = None

@app.get("/annotations")
def list_annotations(
    symbol:    Optional[str] = None,
    timeframe: Optional[str] = None,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db)
):
    q = db.query(WaveAnnotation).filter_by(user_id=user.id)
    if symbol:    q = q.filter(WaveAnnotation.symbol    == symbol)
    if timeframe: q = q.filter(WaveAnnotation.timeframe == timeframe)
    items = q.order_by(WaveAnnotation.timestamp).all()
    return [{"id": a.id, "symbol": a.symbol, "timeframe": a.timeframe,
             "label": a.label, "price": a.price, "timestamp": a.timestamp,
             "color": a.color, "note": a.note,
             "created_at": a.created_at.isoformat()} for a in items]

@app.post("/annotations")
def create_annotation(
    body: AnnotationIn,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db)
):
    if body.symbol not in SYMBOLS:
        raise HTTPException(400, f"Unknown symbol: {body.symbol}")
    ann = WaveAnnotation(
        user_id=user.id, symbol=body.symbol, timeframe=body.timeframe,
        label=body.label, price=body.price, timestamp=body.timestamp,
        color=body.color, note=body.note,
    )
    db.add(ann)
    db.commit()
    return {"id": ann.id, "symbol": ann.symbol, "timeframe": ann.timeframe,
            "label": ann.label, "price": ann.price, "timestamp": ann.timestamp,
            "color": ann.color, "note": ann.note}

@app.patch("/annotations/{annotation_id}")
def update_annotation(
    annotation_id: str,
    body: AnnotationUpdate,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db)
):
    ann = db.get(WaveAnnotation, annotation_id)
    if not ann or ann.user_id != user.id:
        raise HTTPException(404, "Annotation not found")
    if body.label is not None: ann.label = body.label
    if body.price is not None: ann.price = body.price
    if body.color is not None: ann.color = body.color
    if body.note  is not None: ann.note  = body.note
    db.commit()
    return {"id": ann.id, "label": ann.label, "price": ann.price,
            "color": ann.color, "note": ann.note}

@app.delete("/annotations/{annotation_id}")
def delete_annotation(
    annotation_id: str,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db)
):
    ann = db.get(WaveAnnotation, annotation_id)
    if not ann or ann.user_id != user.id:
        raise HTTPException(404, "Annotation not found")
    db.delete(ann)
    db.commit()
    return {"message": "Deleted"}

@app.delete("/annotations")
def delete_annotations_bulk(
    symbol:    str,
    timeframe: str,
    user: User = Depends(get_current_user),
    db:   Session = Depends(get_db)
):
    """指定ペア・時間軸の全アノテーションを削除"""
    deleted = db.query(WaveAnnotation).filter_by(
        user_id=user.id, symbol=symbol, timeframe=timeframe
    ).delete()
    db.commit()
    return {"deleted_count": deleted}

# ─────────────────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    # 接続直後に現在レートを送信
    await ws.send_text(json.dumps({"type": "rate.update", "data": rate_engine.get_rates()}))
    try:
        while True:
            msg = await ws.receive_text()
            data = json.loads(msg)
            if data.get("type") == "sync.request":
                await ws.send_text(json.dumps({"type": "connection.status", "data": {"status": "connected"}}))
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
