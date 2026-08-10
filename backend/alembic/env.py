from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy import text

from alembic import context

from core.config import settings
from db.base import Base
from db import models  # noqa: F401 — 모델 클래스들을 import해야 Base.metadata에 등록됨

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# alembic.ini엔 DB 비밀번호를 안 적어두고, 여기서 .env 기반 설정값으로 채움
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    # postgis/postgis_tiger_geocoder/postgis_topology 확장이 설치한 테이블들은
    # 우리 models.py에 없다고 삭제 대상으로 잡으면 안 되므로 비교 대상에서 제외.
    # 마이그레이션용 커넥션과 트랜잭션이 섞이면 최종 commit이 안 되는 문제가 있어
    # 별도 커넥션으로 조회하고 바로 닫는다.
    with connectable.connect() as probe_connection:
        extension_tables = {
            row[0]
            for row in probe_connection.execute(
                text(
                    """
                    SELECT c.relname
                    FROM pg_class c
                    JOIN pg_depend d ON d.objid = c.oid AND d.deptype = 'e'
                    JOIN pg_extension e ON d.refobjid = e.oid
                    """
                )
            )
        }

    with connectable.connect() as connection:

        def include_object(object, name, type_, reflected, compare_to):
            if type_ == "table" and name in extension_tables:
                return False
            return True

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
