/**
 * Prompt-aware project synthesis for the simulation engine.
 *
 * Given the user's prompt, produce a coherent generated project: a spec,
 * a task DAG, real file contents that stream into the code viewer, one
 * scripted failure (for the self-healing arc), and a final review.
 */
import type { RequirementSpec, ReviewReport, Task } from "@/api/types";

export interface GeneratedFile {
  path: string;
  content: string;
  taskId: string;
}

export interface GeneratedProject {
  name: string;
  spec: RequirementSpec;
  tasks: Task[];
  files: GeneratedFile[];
  failingTaskId: string;
  failureSummary: string;
  review: ReviewReport;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Derive a short project identity from the prompt. */
function identify(prompt: string): { name: string; slug: string; domain: string } {
  const p = prompt.toLowerCase();
  if (/(saas|subscription|billing)/.test(p)) return { name: "Nimbus SaaS", slug: "nimbus", domain: "a multi-tenant SaaS platform" };
  if (/(todo|task)/.test(p)) return { name: "TaskForge", slug: "taskforge", domain: "a task management API" };
  if (/(chat|messag)/.test(p)) return { name: "Relay Chat", slug: "relay", domain: "a real-time chat service" };
  if (/(blog|cms|content)/.test(p)) return { name: "Inkwell CMS", slug: "inkwell", domain: "a content platform" };
  if (/(shop|commerce|store|cart)/.test(p)) return { name: "Cartesian", slug: "cartesian", domain: "an e-commerce backend" };
  if (/(url|shorten|link)/.test(p)) return { name: "Linklet", slug: "linklet", domain: "a URL shortener" };
  const words = prompt.trim().split(/\s+/).slice(0, 3).join(" ");
  return { name: titleCase(words) || "Genesis", slug: "genesis", domain: "the requested application" };
}

export function buildProject(prompt: string): GeneratedProject {
  const id = identify(prompt);
  const s = id.slug;

  const spec: RequirementSpec = {
    summary: `Build ${id.domain} ("${id.name}") from the prompt: ${prompt}`,
    functional_requirements: [
      "Expose a REST API with JSON request/response bodies",
      "Persist data with SQLAlchemy on SQLite (swap-ready for Postgres)",
      "Authenticate users with JWT bearer tokens",
      "Validate every input at the boundary with Pydantic",
      "Ship a pytest suite covering the critical paths",
    ],
    constraints: [
      "Python 3.12, FastAPI, no framework beyond the standard stack",
      "12-factor configuration via environment variables",
      "All secrets injected, never committed",
    ],
    tech_stack: ["Python 3.12", "FastAPI", "SQLAlchemy 2", "Pydantic v2", "pytest", "uvicorn"],
    ambiguities: [
      {
        kind: "resolved",
        question: "Which database engine?",
        chosen_default: "SQLite for development, Postgres-compatible schema",
        rationale: "Zero-setup local dev; SQLAlchemy makes the swap a config change.",
      },
      {
        kind: "resolved",
        question: "Session or token auth?",
        chosen_default: "JWT bearer tokens",
        rationale: "Stateless, standard for API-first products, easy to test.",
      },
    ],
  };

  const tasks: Task[] = [
    { id: "t1", description: "Scaffold project: config, app factory, health endpoint", depends_on: [], status: "pending", attempts: 0, max_attempts: 3 },
    { id: "t2", description: "Data layer: SQLAlchemy models and session management", depends_on: ["t1"], status: "pending", attempts: 0, max_attempts: 3 },
    { id: "t3", description: "Auth: JWT issuance, password hashing, dependencies", depends_on: ["t2"], status: "pending", attempts: 0, max_attempts: 3 },
    { id: "t4", description: "Core API: CRUD routes with validation and pagination", depends_on: ["t2", "t3"], status: "pending", attempts: 0, max_attempts: 3 },
    { id: "t5", description: "Test suite: auth flow + CRUD happy/edge paths", depends_on: ["t4"], status: "pending", attempts: 0, max_attempts: 3 },
  ];

  const files: GeneratedFile[] = [
    {
      taskId: "t1",
      path: `${s}/config.py`,
      content: `"""12-factor configuration for ${id.name}."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="${s.toUpperCase()}_")

    database_url: str = "sqlite:///./${s}.db"
    jwt_secret: str = "change-me"
    jwt_ttl_seconds: int = 3600
    debug: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
`,
    },
    {
      taskId: "t1",
      path: `${s}/main.py`,
      content: `"""${id.name} — application factory and wiring."""

from fastapi import FastAPI

from ${s}.config import get_settings
from ${s}.database import init_db
from ${s}.routes import api_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="${id.name}", debug=settings.debug)
    app.include_router(api_router)

    @app.on_event("startup")
    def _startup() -> None:
        init_db()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
`,
    },
    {
      taskId: "t2",
      path: `${s}/database.py`,
      content: `"""Engine, session factory, and declarative base."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from ${s}.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    get_settings().database_url,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


def init_db() -> None:
    from ${s} import models  # noqa: F401 — register mappings

    Base.metadata.create_all(engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
`,
    },
    {
      taskId: "t2",
      path: `${s}/models.py`,
      content: `"""SQLAlchemy ORM models."""

from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ${s}.database import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    items: Mapped[list["Item"]] = relationship(back_populates="owner")


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    body: Mapped[str] = mapped_column(String(4000), default="")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    owner: Mapped[User] = relationship(back_populates="items")
`,
    },
    {
      taskId: "t3",
      path: `${s}/auth.py`,
      content: `"""JWT issuance and verification."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from ${s}.config import get_settings
from ${s}.database import get_db
from ${s}.models import User

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer()


def hash_password(raw: str) -> str:
    return pwd.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return pwd.verify(raw, hashed)


def create_token(user_id: int) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(UTC) + timedelta(seconds=settings.jwt_ttl_seconds),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def current_user(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    try:
        payload = jwt.decode(creds.credentials, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token") from exc
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "unknown user")
    return user
`,
    },
    {
      taskId: "t4",
      path: `${s}/schemas.py`,
      content: `"""Pydantic request/response models — the API boundary."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(default="", max_length=4000)


class ItemOut(BaseModel):
    id: int
    title: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Page(BaseModel):
    items: list[ItemOut]
    total: int
    offset: int
    limit: int
`,
    },
    {
      taskId: "t4",
      path: `${s}/routes.py`,
      content: `"""API routes: auth + item CRUD with pagination."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ${s}.auth import create_token, current_user, hash_password, verify_password
from ${s}.database import get_db
from ${s}.models import Item, User
from ${s}.schemas import (
    ItemCreate,
    ItemOut,
    Page,
    RegisterRequest,
    TokenResponse,
)

api_router = APIRouter(prefix="/api/v1")
DB = Annotated[Session, Depends(get_db)]
Me = Annotated[User, Depends(current_user)]


@api_router.post("/auth/register", status_code=201, response_model=TokenResponse)
def register(body: RegisterRequest, db: DB) -> TokenResponse:
    exists = db.scalar(select(User).where(User.email == body.email))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    return TokenResponse(access_token=create_token(user.id))


@api_router.post("/auth/login", response_model=TokenResponse)
def login(body: RegisterRequest, db: DB) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "bad credentials")
    return TokenResponse(access_token=create_token(user.id))


@api_router.post("/items", status_code=201, response_model=ItemOut)
def create_item(body: ItemCreate, me: Me, db: DB) -> Item:
    item = Item(title=body.title, body=body.body, owner_id=me.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@api_router.get("/items", response_model=Page)
def list_items(
    me: Me,
    db: DB,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> Page:
    base = select(Item).where(Item.owner_id == me.id)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.scalars(base.order_by(Item.created_at.desc()).offset(offset).limit(limit)).all()
    return Page(
        items=[ItemOut.model_validate(r) for r in rows],
        total=total,
        offset=offset,
        limit=limit,
    )


@api_router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, me: Me, db: DB) -> None:
    item = db.get(Item, item_id)
    if item is None or item.owner_id != me.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "item not found")
    db.delete(item)
    db.commit()
`,
    },
    {
      taskId: "t5",
      path: `tests/test_api.py`,
      content: `"""End-to-end API tests: auth flow + item CRUD."""

import pytest
from fastapi.testclient import TestClient

from ${s}.main import create_app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("${s.toUpperCase()}_DATABASE_URL", f"sqlite:///{tmp_path}/test.db")
    app = create_app()
    with TestClient(app) as c:
        yield c


def register(client: TestClient) -> dict[str, str]:
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "dev@example.com", "password": "hunter2hunter2"},
    )
    assert res.status_code == 201
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_register_login_roundtrip(client):
    register(client)
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "dev@example.com", "password": "hunter2hunter2"},
    )
    assert res.status_code == 200
    assert res.json()["token_type"] == "bearer"


def test_item_crud(client):
    headers = register(client)
    created = client.post(
        "/api/v1/items", json={"title": "First", "body": "hello"}, headers=headers
    )
    assert created.status_code == 201

    page = client.get("/api/v1/items", headers=headers).json()
    assert page["total"] == 1
    assert page["items"][0]["title"] == "First"

    item_id = page["items"][0]["id"]
    assert client.delete(f"/api/v1/items/{item_id}", headers=headers).status_code == 204
    assert client.get("/api/v1/items", headers=headers).json()["total"] == 0


def test_requires_auth(client):
    assert client.get("/api/v1/items").status_code == 403
`,
    },
  ];

  const review: ReviewReport = {
    verdict: "approve_with_findings",
    findings: [
      {
        file: `${s}/config.py`,
        issue: "jwt_secret defaults to 'change-me' — fail hard when unset in production instead of shipping a known default.",
      },
      {
        file: `${s}/routes.py`,
        issue: "login reuses RegisterRequest, so its min_length=8 rule leaks into login validation; a dedicated LoginRequest would return 401 (not 422) for short passwords.",
      },
    ],
    readme_markdown: `# ${id.name}

${titleCase(id.domain)} generated by OrchestrAI from a single prompt.

> ${prompt}

## Stack

- **Python 3.12** + **FastAPI** — async-ready API layer
- **SQLAlchemy 2** — typed ORM, SQLite dev / Postgres-ready
- **Pydantic v2** — validation at every boundary
- **JWT** bearer auth, bcrypt password hashing
- **pytest** — end-to-end API suite

## Quickstart

\`\`\`bash
pip install -e ".[dev]"
uvicorn ${s}.main:app --reload
\`\`\`

## API

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | /api/v1/auth/register | Create account, returns JWT |
| POST | /api/v1/auth/login | Exchange credentials for JWT |
| POST | /api/v1/items | Create an item |
| GET | /api/v1/items | List items (paginated) |
| DELETE | /api/v1/items/{id} | Delete an owned item |

## Configuration

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| ${s.toUpperCase()}_DATABASE_URL | sqlite:///./${s}.db | SQLAlchemy URL |
| ${s.toUpperCase()}_JWT_SECRET | change-me | Token signing key — **set in prod** |
| ${s.toUpperCase()}_JWT_TTL_SECONDS | 3600 | Token lifetime |

## Tests

\`\`\`bash
pytest -q
\`\`\`
`,
  };

  return {
    name: id.name,
    spec,
    tasks,
    files,
    failingTaskId: "t4",
    failureSummary:
      "tests/test_api.py::test_item_crud — AssertionError: expected page['total'] == 1, got 0 (list query filtered by owner_id before commit flushed)",
    review,
  };
}
