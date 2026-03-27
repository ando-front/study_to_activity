from backend.database import Base, SessionLocal, engine
from backend.models import ActivityWallet, User, UserRole
from backend.routers.rules import seed_default_rules
from backend.security import hash_pin


def seed():
    # Create tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("Database already contains users. Skipping seed.")
            return

        parent = User(name="お父さん", role=UserRole.PARENT, pin=hash_pin("1234"))
        db.add(parent)

        child = User(name="たろう", role=UserRole.CHILD, pin=hash_pin("0000"))
        db.add(child)
        db.flush()

        wallet = ActivityWallet(
            child_id=child.id, balance_minutes=60, daily_limit_minutes=120
        )
        db.add(wallet)

        seed_default_rules(db)

        db.commit()
        print("Seed data created successfully!")
        print(f"Parent: {parent.name} (ID: {parent.id})")
        print(f"Child: {child.name} (ID: {child.id})")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
