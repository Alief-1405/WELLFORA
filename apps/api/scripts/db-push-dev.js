const { execSync } = require("node:child_process");
require("dotenv/config");

if (process.env.NODE_ENV === "production") {
  throw new Error("db:push is disabled in production. Deploy reviewed migrations instead.");
}

execSync("prisma db push", { stdio: "inherit" });
