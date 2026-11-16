import "dotenv/config";
import app from "./index";
import { prisma } from "./shared/prisma";

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => console.info(`Wellfora API server running on http://localhost:${port}`));

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
