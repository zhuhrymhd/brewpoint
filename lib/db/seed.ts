import { db } from "@/lib/db";
import { users, categories, products } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const [admin, cashier] = await db
    .insert(users)
    .values([
      {
        username: "admin",
        passwordHash: await hashPassword("admin123"),
        name: "Marcus Bell",
        role: "admin",
      },
      {
        username: "cashier",
        passwordHash: await hashPassword("cashier123"),
        name: "Sam Rivera",
        role: "cashier",
      },
    ])
    .returning();

  const [espresso, nonCoffee, tea, pastry] = await db
    .insert(categories)
    .values([
      { name: "Espresso" },
      { name: "Non-Coffee" },
      { name: "Tea" },
      { name: "Pastry" },
    ])
    .returning();

  await db.insert(products).values([
    // Espresso
    {
      name: "Cappuccino",
      price: "4.25",
      stockQuantity: 36,
      categoryId: espresso.id,
      barcode: "7850021401",
    },
    {
      name: "Caffè Latte",
      price: "4.75",
      stockQuantity: 41,
      categoryId: espresso.id,
      barcode: "7850021402",
    },
    {
      name: "Americano",
      price: "3.50",
      stockQuantity: 50,
      categoryId: espresso.id,
      barcode: "7850021403",
    },
    {
      name: "Espresso Shot",
      price: "2.75",
      stockQuantity: 60,
      categoryId: espresso.id,
      barcode: "7850021404",
    },
    {
      name: "Mocha",
      price: "4.95",
      stockQuantity: 0,
      categoryId: espresso.id,
      barcode: "7850021405",
    },
    // Non-Coffee
    {
      name: "Matcha Latte",
      price: "5.25",
      stockQuantity: 22,
      categoryId: nonCoffee.id,
      barcode: "7850021406",
    },
    {
      name: "Hot Chocolate",
      price: "4.50",
      stockQuantity: 28,
      categoryId: nonCoffee.id,
      barcode: "7850021407",
    },
    {
      name: "Chai Latte",
      price: "4.75",
      stockQuantity: 4,
      categoryId: nonCoffee.id,
      barcode: "7850021408",
    },
    // Tea
    {
      name: "Earl Grey Tea",
      price: "3.25",
      stockQuantity: 30,
      categoryId: tea.id,
      barcode: "7850021409",
    },
    {
      name: "Green Tea",
      price: "3.25",
      stockQuantity: 33,
      categoryId: tea.id,
      barcode: "7850021410",
    },
    // Pastry
    {
      name: "Butter Croissant",
      price: "3.75",
      stockQuantity: 18,
      categoryId: pastry.id,
      barcode: "7850021411",
    },
    {
      name: "Blueberry Muffin",
      price: "3.95",
      stockQuantity: 3,
      categoryId: pastry.id,
      barcode: "7850021412",
    },
    {
      name: "Chocolate Chip Cookie",
      price: "2.95",
      stockQuantity: 25,
      categoryId: pastry.id,
      barcode: "7850021413",
    },
    {
      name: "Cinnamon Roll",
      price: "4.25",
      stockQuantity: 15,
      categoryId: pastry.id,
      barcode: "7850021414",
    },
  ]);

  console.log(
    "Seed complete. Admin username:",
    admin.username,
    "| Cashier username:",
    cashier.username,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
