export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Viora Bills API",
    version: "0.2.0",
    description:
      "Tenant-scoped billing API. Mutations using browser cookies require X-Viora-Client: web. All list endpoints are paginated unless documented as summaries.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      cookieSession: { type: "apiKey", in: "cookie", name: "viora_session" },
      bearerSession: { type: "http", scheme: "bearer" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
  },
  security: [{ cookieSession: [] }, { bearerSession: [] }],
  paths: {},
};
const groups: Record<string, string[]> = {
  "/health": ["get"],
  "/auth/register": ["post"],
  "/auth/login": ["post"],
  "/auth/logout": ["post"],
  "/auth/me": ["get"],
  "/auth/members": ["post"],
  "/auth/switch-business": ["post"],
  "/business": ["get", "put"],
  "/customers": ["get", "post"],
  "/customers/{id}": ["get", "put", "delete"],
  "/customers/{id}/statement": ["get"],
  "/products": ["get", "post"],
  "/products/{id}": ["get", "put", "delete"],
  "/invoices": ["get", "post"],
  "/invoices/{id}": ["get", "put", "delete"],
  "/invoices/{id}/issue": ["post"],
  "/invoices/{id}/cancel": ["post"],
  "/invoices/{id}/pdf": ["get"],
  "/invoices/{id}/payments": ["post"],
  "/invoices/bulk-delete": ["post"],
  "/payments": ["get", "post"],
  "/payments/{id}/reverse": ["post"],
  "/credit-notes": ["get", "post"],
  "/credit-notes/eligible/{id}": ["get"],
  "/dashboard/summary": ["get"],
  "/reports/sales": ["get"],
  "/search": ["get"],
};
for (const [path, methods] of Object.entries(groups)) {
  const operations: Record<string, unknown> = {};
  for (const method of methods) {
    const parameters: Array<Record<string, unknown>> = [];
    if (path.includes("{id}"))
      parameters.push({
        in: "path",
        name: "id",
        required: true,
        schema: { type: "string" },
      });
    if (
      method === "get" &&
      [
        "/invoices",
        "/customers",
        "/products",
        "/payments",
        "/credit-notes",
        "/customers/{id}/statement",
      ].includes(path)
    )
      for (const name of ["page", "limit"])
        parameters.push({
          in: "query",
          name,
          schema: {
            type: "integer",
            minimum: 1,
            default: name === "page" ? 1 : 20,
          },
        });
    if (method !== "get")
      parameters.push({
        in: "header",
        name: "X-Viora-Client",
        description: "Required for browser cookie requests",
        schema: { type: "string", enum: ["web"] },
      });
    operations[method] = {
      summary: method.toUpperCase() + " " + path,
      parameters,
      ...(["/health", "/auth/login", "/auth/register"].includes(path)
        ? { security: [] }
        : {}),
      responses: {
        "200": { description: "Successful response" },
        "201": { description: "Created" },
        "400": { description: "Invalid input" },
        "401": { description: "Authentication required" },
        "403": { description: "Insufficient access" },
        "409": { description: "Conflict" },
        "429": { description: "Rate limited" },
      },
    };
  }
  (openapi.paths as Record<string, unknown>)[path] = operations;
}

const schemas: Record<string, unknown> = openapi.components.schemas;
const string = { type: "string" },
  money = { type: "number", minimum: 0 };
schemas.Login = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string", format: "email" },
    password: { type: "string", maxLength: 128 },
  },
};
schemas.Register = {
  type: "object",
  required: ["email", "password", "name"],
  properties: {
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 12, maxLength: 128 },
    name: string,
    businessName: string,
  },
};
schemas.Customer = {
  type: "object",
  required: ["name", "billingAddress"],
  properties: {
    name: string,
    phone: string,
    email: { type: "string", format: "email" },
    billingAddress: string,
    gstin: string,
    state: string,
  },
};
schemas.Product = {
  type: "object",
  required: ["name", "unitPrice"],
  properties: {
    name: string,
    description: string,
    unit: string,
    unitPrice: money,
    taxRate: { type: "number", minimum: 0, maximum: 100 },
    isActive: { type: "boolean" },
  },
};
schemas.Invoice = {
  type: "object",
  required: ["customerId", "invoiceDate", "dueDate", "items"],
  properties: {
    customerId: string,
    invoiceDate: { type: "string", format: "date" },
    dueDate: { type: "string", format: "date" },
    placeOfSupply: string,
    notes: string,
    items: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: {
        type: "object",
        required: ["descriptionSnapshot", "quantity", "unitPrice"],
        properties: {
          productId: string,
          descriptionSnapshot: string,
          quantity: { type: "number", exclusiveMinimum: true, minimum: 0 },
          unitPrice: money,
          discountAmount: money,
          taxRate: { type: "number", minimum: 0, maximum: 100 },
        },
      },
    },
  },
};
schemas.Payment = {
  type: "object",
  required: ["amount", "requestKey"],
  properties: {
    amount: {
      type: "number",
      minimum: 0,
      exclusiveMinimum: true,
      multipleOf: 0.01,
    },
    requestKey: string,
    paymentDate: { type: "string", format: "date" },
    method: {
      type: "string",
      enum: ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "CARD", "OTHER"],
    },
    reference: string,
  },
};
schemas.CreditNote = {
  type: "object",
  required: ["invoiceId", "reason", "requestKey", "items"],
  properties: {
    invoiceId: { type: "string", format: "uuid" },
    reason: { type: "string", minLength: 3, maxLength: 500 },
    requestKey: { type: "string", minLength: 8, maxLength: 100 },
    items: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: {
        type: "object",
        required: ["invoiceItemId", "quantity"],
        properties: {
          invoiceItemId: { type: "string", format: "uuid" },
          quantity: {
            type: "number",
            minimum: 0,
            exclusiveMinimum: true,
            multipleOf: 0.001,
          },
        },
      },
    },
  },
};
const requestSchemas: Record<string, string> = {
  "/auth/login": "Login",
  "/auth/register": "Register",
  "/customers": "Customer",
  "/products": "Product",
  "/invoices": "Invoice",
  "/invoices/{id}": "Invoice",
  "/invoices/{id}/payments": "Payment",
  "/credit-notes": "CreditNote",
};
for (const [path, schema] of Object.entries(requestSchemas))
  for (const method of ["post", "put"]) {
    const operation = ((
      openapi.paths as Record<string, Record<string, Record<string, unknown>>>
    )[path] || {})[method];
    if (operation)
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/" + schema },
          },
        },
      };
  }
