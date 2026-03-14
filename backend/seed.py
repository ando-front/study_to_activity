from backend.database import Base, SessionLocal, engine
from backend.models import ActivityWallet, User, UserRole
from backend.routers.rules import seed_default_rules


def seed():
    # Create tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Check if users exist
        if db.query(User).count() > 0:
            print("Database already contains users. Skipping seed.")
            return

        # 1. Create Parent
        parent = User(name="お父さん", role=UserRole.PARENT, pin="1234")
        db.add(parent)

        # 2. Create Child
        child = User(name="たろう", role=UserRole.CHILD, pin="0000")
        db.add(child)
        db.flush()  # Get IDs

        # 3. Create Wallet for Child
        wallet = ActivityWallet(
            child_id=child.id, balance_minutes=60, daily_limit_minutes=120
        )
        db.add(wallet)

        # 4. Seed Default Rules
        seed_default_rules(db)

        db.commit()
        print("Seed data created successfully!")
        print(f"Parent: {parent.name} (ID: {parent.id})")
        print(f"Child: {child.name} (ID: {child.id})")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
