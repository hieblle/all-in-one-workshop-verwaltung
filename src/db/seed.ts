import "dotenv/config";
import { db } from "./index";
import { applySeed } from "./seed-data";

applySeed(db)
  .then((result) => {
    console.log(
      result === "seeded"
        ? "Seed complete."
        : "Database already contains data — skipping seed.",
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
