import { createMobileGatewayApp } from "./server";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const dataRoot = process.env.OC_DATA_ROOT;
const app = createMobileGatewayApp({ dataRoot });

app
  .listen({ port, host })
  .then(() => {
    app.log.info({ port, host, dataRoot }, "oc mobile gateway listening");
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
