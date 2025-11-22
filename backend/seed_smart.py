import os
import random
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import create_engine, text

random.seed(42)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/siprems_db")
engine = create_engine(DATABASE_URL)

# Product catalog (30 items)
PRODUCT_CATALOG = [
    # Coffee (10)
    {"sku": "CF-001", "name": "Heritage Espresso", "category": "Coffee", "cost_price": 1.20, "selling_price": 3.20, "stock": 220, "is_seasonal": False, "description": "Double-shot espresso with caramelized finish."},
    {"sku": "CF-002", "name": "Midnight Americano", "category": "Coffee", "cost_price": 1.10, "selling_price": 3.50, "stock": 210, "is_seasonal": False, "description": "Bold americano served hot or iced."},
    {"sku": "CF-003", "name": "Caramel Cloud Latte", "category": "Coffee", "cost_price": 1.60, "selling_price": 4.80, "stock": 200, "is_seasonal": False, "description": "Steamed milk microfoam with burnt caramel."},
    {"sku": "CF-004", "name": "Velvet Vanilla Latte", "category": "Coffee", "cost_price": 1.55, "selling_price": 4.60, "stock": 180, "is_seasonal": False, "description": "Madagascar vanilla bean latte."},
    {"sku": "CF-005", "name": "Mocha Truffle", "category": "Coffee", "cost_price": 1.75, "selling_price": 5.10, "stock": 170, "is_seasonal": False, "description": "Dark chocolate mocha with cocoa nibs."},
    {"sku": "CF-006", "name": "Flat White Reserve", "category": "Coffee", "cost_price": 1.40, "selling_price": 4.20, "stock": 190, "is_seasonal": False, "description": "Silky ristretto blend."},
    {"sku": "CF-007", "name": "Hazelnut Cappuccino", "category": "Coffee", "cost_price": 1.50, "selling_price": 4.50, "stock": 185, "is_seasonal": False, "description": "Foamy cappuccino with roasted hazelnut."},
    {"sku": "CF-008", "name": "Nitro Cold Brew", "category": "Coffee", "cost_price": 1.95, "selling_price": 5.60, "stock": 150, "is_seasonal": False, "description": "Slow-steeped cold brew on nitro tap."},
    {"sku": "CF-009", "name": "Coconut Latte", "category": "Coffee", "cost_price": 1.70, "selling_price": 4.90, "stock": 160, "is_seasonal": False, "description": "Creamy coconut milk latte."},
    {"sku": "CF-010", "name": "Espresso Tonic", "category": "Coffee", "cost_price": 1.45, "selling_price": 4.30, "stock": 155, "is_seasonal": False, "description": "Citrus tonic layered with espresso."},

    # Tea (5)
    {"sku": "TE-011", "name": "Jasmine Green Tea", "category": "Tea", "cost_price": 0.90, "selling_price": 3.50, "stock": 140, "is_seasonal": False, "description": "Hand-steeped jasmine pearls."},
    {"sku": "TE-012", "name": "Earl Grey Creme", "category": "Tea", "cost_price": 1.00, "selling_price": 3.80, "stock": 135, "is_seasonal": False, "description": "Bergamot black tea with vanilla foam."},
    {"sku": "TE-013", "name": "Masala Chai Latte", "category": "Tea", "cost_price": 1.10, "selling_price": 4.00, "stock": 150, "is_seasonal": False, "description": "Spiced chai with oat milk."},
    {"sku": "TE-014", "name": "Hibiscus Citrus Cooler", "category": "Tea", "cost_price": 0.95, "selling_price": 3.90, "stock": 130, "is_seasonal": False, "description": "Iced hibiscus tea with yuzu."},
    {"sku": "TE-015", "name": "Ceremonial Matcha", "category": "Tea", "cost_price": 1.80, "selling_price": 5.40, "stock": 125, "is_seasonal": False, "description": "Stone-ground matcha whisked to order."},

    # Non-coffee beverages (5)
    {"sku": "NC-016", "name": "Dark Chocolate Frappe", "category": "Non-Coffee", "cost_price": 1.90, "selling_price": 5.80, "stock": 145, "is_seasonal": False, "description": "Rich chocolate frappe with cream."},
    {"sku": "NC-017", "name": "Salted Caramel Frappe", "category": "Non-Coffee", "cost_price": 1.85, "selling_price": 5.70, "stock": 150, "is_seasonal": False, "description": "Butterscotch caramel shake."},
    {"sku": "NC-018", "name": "Tropical Sunrise Smoothie", "category": "Non-Coffee", "cost_price": 1.60, "selling_price": 5.10, "stock": 140, "is_seasonal": False, "description": "Mango-pineapple smoothie."},
    {"sku": "NC-019", "name": "Sparkling Yuzu Ade", "category": "Non-Coffee", "cost_price": 1.30, "selling_price": 4.60, "stock": 135, "is_seasonal": False, "description": "Sparkling citrus cooler."},
    {"sku": "NC-020", "name": "Charcoal Lemonade", "category": "Non-Coffee", "cost_price": 1.20, "selling_price": 4.30, "stock": 120, "is_seasonal": False, "description": "Activated charcoal detox."},

    # Pastry (5)
    {"sku": "PS-021", "name": "Butter Croissant", "category": "Pastry", "cost_price": 0.90, "selling_price": 2.80, "stock": 110, "is_seasonal": False, "description": "Layered French butter croissant."},
    {"sku": "PS-022", "name": "Almond Twice-Baked", "category": "Pastry", "cost_price": 1.10, "selling_price": 3.60, "stock": 105, "is_seasonal": False, "description": "Almond cream croissant."},
    {"sku": "PS-023", "name": "Cardamom Cinnamon Roll", "category": "Pastry", "cost_price": 1.30, "selling_price": 4.20, "stock": 100, "is_seasonal": False, "description": "Yeasted roll with citrus glaze."},
    {"sku": "PS-024", "name": "Dark Chocolate Lava Cake", "category": "Pastry", "cost_price": 1.90, "selling_price": 5.90, "stock": 95, "is_seasonal": False, "description": "Molten center mini cake."},
    {"sku": "PS-025", "name": "Roasted Fruit Tart", "category": "Pastry", "cost_price": 1.50, "selling_price": 4.80, "stock": 98, "is_seasonal": False, "description": "Seasonal fruit tart."},

    # Light meals (3)
    {"sku": "LM-026", "name": "Truffle Mushroom Toast", "category": "Light Meals", "cost_price": 2.60, "selling_price": 7.80, "stock": 85, "is_seasonal": False, "description": "Sourdough with truffle mushrooms."},
    {"sku": "LM-027", "name": "Smoked Chicken Sandwich", "category": "Light Meals", "cost_price": 2.90, "selling_price": 8.20, "stock": 90, "is_seasonal": False, "description": "Smoked chicken with herb aioli."},
    {"sku": "LM-028", "name": "Roasted Veggie Panini", "category": "Light Meals", "cost_price": 2.70, "selling_price": 7.90, "stock": 88, "is_seasonal": False, "description": "Mediterranean veggie panini."},

    # Seasonal menu (2)
    {"sku": "SN-029", "name": "Pandan Coconut Latte", "category": "Seasonal", "cost_price": 1.80, "selling_price": 5.40, "stock": 130, "is_seasonal": True, "description": "Limited pandan latte."},
    {"sku": "SN-030", "name": "Strawberry Cheesecake Frappe", "category": "Seasonal", "cost_price": 1.95, "selling_price": 5.90, "stock": 125, "is_seasonal": True, "description": "Summer berry frappe."}
]

# Calendar events will be generated dynamically based on START_DATE
# This function will be called after START_DATE is determined
def generate_calendar_events(start_date, num_days):
    """Generate calendar events spread throughout the date range"""
    events = []
    end_date = start_date + timedelta(days=num_days - 1)
    
    # Spread events throughout the 6-month period
    events.append({"date": start_date + timedelta(days=5), "title": "Seasonal Menu Launch", "type": "promotion", "impact_weight": 0.35, "category": "seasonal-launch", "description": "New seasonal drinks kickoff."})
    events.append({"date": start_date + timedelta(days=15), "title": "Weekend Jazz Night", "type": "event", "impact_weight": 0.55, "category": "entertainment", "description": "Live music & dessert pairing."})
    events.append({"date": start_date + timedelta(days=25), "title": "Payday Treat Promo", "type": "promotion", "impact_weight": 0.45, "category": "payday", "description": "Buy 2 drinks get pastry 50% off."})
    events.append({"date": start_date + timedelta(days=35), "title": "Happy Hour Special", "type": "event", "impact_weight": 0.40, "category": "time-discount", "description": "Afternoon beverage discounts."})
    events.append({"date": start_date + timedelta(days=45), "title": "Cold Drink Festival", "type": "promotion", "impact_weight": 0.40, "category": "cold-drink", "description": "Iced drinks special pricing."})
    events.append({"date": start_date + timedelta(days=50), "title": "Valentine Celebration", "type": "event", "impact_weight": 0.65, "category": "valentine", "description": "Couple dessert sets."})
    events.append({"date": start_date + timedelta(days=60), "title": "Equipment Maintenance", "type": "store-closed", "impact_weight": 1.00, "category": "maintenance", "description": "Store closed until noon."})
    events.append({"date": start_date + timedelta(days=70), "title": "Spring Menu Launch", "type": "promotion", "impact_weight": 0.75, "category": "seasonal", "description": "Fresh spring beverages."})
    events.append({"date": start_date + timedelta(days=85), "title": "Community Gathering", "type": "holiday", "impact_weight": 1.10, "category": "community", "description": "Local community event."})
    events.append({"date": start_date + timedelta(days=95), "title": "Cafe Anniversary Week", "type": "event", "impact_weight": 0.60, "category": "anniversary", "description": "Anniversary celebrations."})
    events.append({"date": start_date + timedelta(days=105), "title": "Coffee Tasting Event", "type": "event", "impact_weight": 0.45, "category": "community", "description": "Local roaster tasting."})
    events.append({"date": start_date + timedelta(days=120), "title": "Payday Super Sale", "type": "promotion", "impact_weight": 0.70, "category": "payday", "description": "Buy 2 get 1 free."})
    events.append({"date": start_date + timedelta(days=140), "title": "Summer Cooler Launch", "type": "promotion", "impact_weight": 0.60, "category": "cold-drink", "description": "New cold beverage lineup."})
    events.append({"date": start_date + timedelta(days=155), "title": "Independence Day Special", "type": "holiday", "impact_weight": 0.85, "category": "national", "description": "Patriotic themed menu."})
    events.append({"date": start_date + timedelta(days=165), "title": "Mid-Season Sale", "type": "promotion", "impact_weight": 0.50, "category": "sale", "description": "Special discounts on select items."})
    events.append({"date": start_date + timedelta(days=175), "title": "Customer Appreciation Day", "type": "event", "impact_weight": 0.55, "category": "customer", "description": "Thank you event for loyal customers."})
    
    # Add a few future events for forecasting (7-60 days ahead)
    events.append({"date": end_date + timedelta(days=10), "title": "Upcoming Holiday Promo", "type": "promotion", "impact_weight": 0.60, "category": "upcoming", "description": "Planned promotional event."})
    events.append({"date": end_date + timedelta(days=25), "title": "New Product Launch", "type": "event", "impact_weight": 0.70, "category": "upcoming", "description": "Exciting new menu items."})
    
    return events

CALENDAR_EVENTS = []  # Will be populated in main()

PAYMENT_METHODS = ["Cash", "QRIS", "Debit Card", "Credit Card", "E-Wallet"]
CUSTOMER_SEGMENTS = ["dine-in", "takeaway", "delivery"]

HOUR_DISTRIBUTION = {
    7: 1,
    8: 3,
    9: 4,
    10: 3,
    11: 5,
    12: 6,
    13: 5,
    14: 4,
    15: 4,
    16: 4,
    17: 5,
    18: 6,
    19: 5,
    20: 4,
    21: 3,
    22: 2
}

SEGMENT_WEIGHTS = {
    "morning": {"Coffee": 0.55, "Tea": 0.10, "Pastry": 0.25, "Light Meals": 0.05, "Non-Coffee": 0.03, "Seasonal": 0.02},
    "midday": {"Coffee": 0.38, "Tea": 0.10, "Pastry": 0.15, "Light Meals": 0.22, "Non-Coffee": 0.10, "Seasonal": 0.05},
    "afternoon": {"Coffee": 0.30, "Tea": 0.18, "Pastry": 0.18, "Light Meals": 0.08, "Non-Coffee": 0.18, "Seasonal": 0.08},
    "evening": {"Coffee": 0.42, "Tea": 0.08, "Pastry": 0.12, "Light Meals": 0.18, "Non-Coffee": 0.12, "Seasonal": 0.08}
}

# Generate data ending ~7 days ago so there's recent historical data
END_DATE = date.today() - timedelta(days=7)
NUM_DAYS = 183  # ~6 months
START_DATE = END_DATE - timedelta(days=NUM_DAYS - 1)


def reset_tables(conn):
    conn.execute(text("""
        TRUNCATE TABLE sales_forecasts, transaction_items, transactions, calendar_events, products
        RESTART IDENTITY CASCADE
    """))


def seed_products(conn):
    insert_sql = text("""
        INSERT INTO products (name, category, sku, description, cost_price, selling_price, stock, is_seasonal)
        VALUES (:name, :category, :sku, :description, :cost_price, :selling_price, :stock, :is_seasonal)
    """)
    conn.execute(insert_sql, PRODUCT_CATALOG)
    rows = conn.execute(text("SELECT id, name, category, selling_price FROM products"))
    return [dict(row._mapping) for row in rows]


def seed_calendar(conn):
    insert_sql = text("""
        INSERT INTO calendar_events (date, title, type, impact_weight, category, description)
        VALUES (:date, :title, :type, :impact_weight, :category, :description)
    """)
    conn.execute(insert_sql, CALENDAR_EVENTS)


def segment_for_hour(hour: int) -> str:
    if 7 <= hour < 11:
        return "morning"
    if 11 <= hour < 15:
        return "midday"
    if 15 <= hour < 18:
        return "afternoon"
    return "evening"


def determine_quantity(category: str) -> int:
    if category in {"Pastry", "Light Meals"}:
        return random.randint(1, 2)
    if category == "Seasonal":
        return random.randint(1, 3)
    return random.randint(1, 2)


def calculate_daily_target(current_date: date, events_map: dict) -> int:
    weekday = current_date.weekday()
    base = random.randint(30, 60) if weekday < 5 else random.randint(70, 110)
    day_events = events_map.get(current_date, [])
    if any(evt["type"] == "store-closed" for evt in day_events):
        return random.randint(2, 6)
    boost = sum(evt["impact_weight"] for evt in day_events)
    boosted = int(round(base * (1 + boost)))
    cap = 120 if weekday < 5 else 150
    floor = 20 if weekday < 5 else 45
    return max(floor, min(boosted, cap))


def pick_product(segment: str, category_map, all_products, used_ids):
    weights = SEGMENT_WEIGHTS[segment]
    categories = list(weights.keys())
    probs = [weights[cat] for cat in categories]
    for _ in range(5):
        chosen_category = random.choices(categories, weights=probs, k=1)[0]
        bucket = category_map.get(chosen_category)
        if not bucket:
            continue
        candidate = random.choice(bucket)
        if candidate["id"] not in used_ids or len(bucket) == 1:
            return candidate
    fallback = [p for p in all_products if p["id"] not in used_ids] or all_products
    return random.choice(fallback)


def build_transactions(product_rows):
    category_map = defaultdict(list)
    for prod in product_rows:
        category_map[prod["category"]].append(prod)
    all_products = [prod for prod in product_rows]

    events_map = defaultdict(list)
    for evt in CALENDAR_EVENTS:
        events_map[evt["date"]].append(evt)

    hour_choices = list(HOUR_DISTRIBUTION.keys())
    hour_weights = list(HOUR_DISTRIBUTION.values())

    transactions_batch = []
    items_batch = []

    current_date = START_DATE
    for day_index in range(NUM_DAYS):
        tx_count = calculate_daily_target(current_date, events_map)
        for _ in range(tx_count):
            transaction_id = str(uuid.uuid4())
            hour = random.choices(hour_choices, weights=hour_weights, k=1)[0]
            minute = random.randint(0, 59)
            timestamp = datetime(current_date.year, current_date.month, current_date.day, hour, minute)
            segment = segment_for_hour(hour)

            num_products = random.choices([1, 2, 3, 4], weights=[45, 30, 18, 7], k=1)[0]
            used_ids = set()
            line_items = []
            for _ in range(num_products):
                product = pick_product(segment, category_map, all_products, used_ids)
                qty = determine_quantity(product["category"])
                subtotal = round(product["selling_price"] * qty, 2)
                line_items.append({
                    "transaction_id": transaction_id,
                    "product_id": product["id"],
                    "quantity": qty,
                    "unit_price": product["selling_price"],
                    "subtotal": subtotal
                })
                used_ids.add(product["id"])

            total_amount = round(sum(item["subtotal"] for item in line_items), 2)
            items_count = sum(item["quantity"] for item in line_items)

            transactions_batch.append({
                "id": transaction_id,
                "date": timestamp,
                "total_amount": total_amount,
                "payment_method": random.choice(PAYMENT_METHODS),
                "customer_segment": random.choices(CUSTOMER_SEGMENTS, weights=[0.55, 0.35, 0.10])[0],
                "items_count": items_count
            })
            items_batch.extend(line_items)

        current_date += timedelta(days=1)

    return transactions_batch, items_batch


def insert_transactions(conn, transactions_batch, items_batch):
    tx_sql = text("""
        INSERT INTO transactions (id, date, total_amount, payment_method, customer_segment, items_count)
        VALUES (:id, :date, :total_amount, :payment_method, :customer_segment, :items_count)
    """)
    item_sql = text("""
        INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal)
        VALUES (:transaction_id, :product_id, :quantity, :unit_price, :subtotal)
    """)

    conn.execute(tx_sql, transactions_batch)
    conn.execute(item_sql, items_batch)


def main():
    global CALENDAR_EVENTS
    
    # Generate dynamic calendar events based on the calculated date range
    CALENDAR_EVENTS = generate_calendar_events(START_DATE, NUM_DAYS)
    
    with engine.begin() as conn:
        reset_tables(conn)
        product_rows = seed_products(conn)
        seed_calendar(conn)
        transactions_batch, items_batch = build_transactions(product_rows)
        insert_transactions(conn, transactions_batch, items_batch)

    total_transactions = len(transactions_batch)
    avg_per_day = total_transactions / NUM_DAYS
    print(f"Date range: {START_DATE} to {START_DATE + timedelta(days=NUM_DAYS - 1)}")
    print(f"Seeded {len(PRODUCT_CATALOG)} products, {len(CALENDAR_EVENTS)} calendar events.")
    print(f"Generated {total_transactions} transactions (~{avg_per_day:.1f}/day) across {NUM_DAYS} days.")
    print(f"Generated {len(items_batch)} transaction line items to power Prophet forecasts.")


if __name__ == "__main__":
    main()