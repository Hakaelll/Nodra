import "dotenv/config";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { testDatabaseUrl } from "./test-database.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
process.env.DATABASE_URL = testDatabaseUrl(process.env.TEST_DATABASE_URL);
process.env.NODE_ENV = "test";
const require = createRequire(import.meta.url);
assert(existsSync(join(root, "apps/api/dist/app.js")), "Build the API first.");
const { createApp } = require(join(root, "apps/api/dist/app.js"));
const { errorOutput } = require(
  join(root, "apps/api/dist/auth/auth.schemas.js"),
);
const routes = [];
const verbs = ["Get", "Post", "Patch", "Delete", "Put", "Head", "Options"];
const excluded = new Set(["/health", "/health/ready"]);

function decorator(node, name) {
  return (
    ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : []
  ).find(
    (item) =>
      ts.isCallExpression(item.expression) &&
      item.expression.expression.getText() === name,
  )?.expression;
}
function literal(call) {
  if (!call?.arguments.length) return "";
  assert(
    ts.isStringLiteralLike(call.arguments[0]),
    "Route and named query decorators must use literal strings.",
  );
  return call.arguments[0].text;
}
function guarded(node) {
  return (
    decorator(node, "UseGuards")?.arguments.some(
      (arg) => arg.getText() === "AuthGuard",
    ) ?? false
  );
}
function scan(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const file = join(folder, entry.name);
    if (entry.isDirectory()) {
      scan(file);
      continue;
    }
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      if (ts.isClassDeclaration(node) && decorator(node, "Controller")) {
        const prefix = literal(decorator(node, "Controller"));
        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member)) continue;
          for (const verb of verbs) {
            const call = decorator(member, verb);
            if (!call) continue;
            const url = "/" + [prefix, literal(call)].filter(Boolean).join("/");
            routes.push({
              method: verb.toLowerCase(),
              path:
                (excluded.has(url) ? "" : "/api/v1") +
                url.replace(/:([^/]+)/g, "{$1}"),
              guarded: guarded(node) || guarded(member),
              body: member.parameters.some((parameter) =>
                decorator(parameter, "Body"),
              ),
              queries: member.parameters
                .map((parameter) => literal(decorator(parameter, "Query")))
                .filter(Boolean),
              source: relative(root, file).replaceAll("\\", "/"),
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
scan(join(root, "apps/api/src"));

const app = await createApp(false);
try {
  const response = await app.inject({ method: "GET", url: "/docs-json" });
  assert.equal(response.statusCode, 200);
  const spec = response.json();
  const avatar = spec.paths["/api/v1/auth/me/avatar"].post;
  assert.equal(
    avatar.requestBody?.required,
    true,
    "JPEG body must be required",
  );
  assert.deepEqual(
    avatar.requestBody.content,
    { "image/jpeg": { schema: { type: "string", format: "binary" } } },
    "Avatar upload must document raw JPEG bytes",
  );
  for (const status of ["413", "415"]) {
    assert(
      avatar.responses[status]?.content?.["application/json"]?.schema,
      `Avatar upload: ${status} schema missing`,
    );
  }
  const documented = new Set(
    Object.entries(spec.paths).flatMap(([path, value]) =>
      Object.keys(value)
        .filter((method) => verbs.some((verb) => verb.toLowerCase() === method))
        .map((method) => `${method} ${path}`),
    ),
  );
  assert.equal(
    new Set(routes.map((route) => `${route.method} ${route.path}`)).size,
    routes.length,
    "Duplicate controller routes",
  );
  assert.deepEqual(
    [...documented].sort(),
    routes.map((route) => `${route.method} ${route.path}`).sort(),
    "OpenAPI/controller route mismatch",
  );
  let protectedRoutes = 0;
  for (const route of routes) {
    const label = `${route.method.toUpperCase()} ${route.path}`;
    const operation = spec.paths[route.path][route.method];
    assert(
      Object.entries(operation.responses).some(
        ([status, result]) =>
          /^2\d\d$/.test(status) &&
          (status === "204" ||
            Object.values(result.content ?? {}).some(
              (media) => media.schema && Object.keys(media.schema).length,
            )),
      ),
      `${label}: success schema missing`,
    );
    assert.equal(
      operation.security?.some((security) =>
        Object.hasOwn(security, "bearer"),
      ) ?? false,
      route.guarded,
      `${label}: bearer/guard mismatch`,
    );
    const parameters = [
      ...(spec.paths[route.path].parameters ?? []),
      ...(operation.parameters ?? []),
    ];
    for (const [, name] of route.path.matchAll(/\{([^}]+)\}/g)) {
      assert(
        parameters.some(
          (parameter) =>
            parameter.in === "path" &&
            parameter.name === name &&
            parameter.required &&
            parameter.schema?.format === "uuid",
        ),
        `${label}: UUID path parameter ${name} missing`,
      );
    }
    for (const name of route.queries) {
      assert(
        parameters.some(
          (parameter) =>
            parameter.in === "query" &&
            parameter.name === name &&
            parameter.schema,
        ),
        `${label}: query parameter ${name} missing`,
      );
    }
    const media = Object.keys(operation.requestBody?.content ?? {})[0];
    if (route.body) {
      assert(
        media && operation.requestBody.content[media].schema,
        `${label}: request body schema missing`,
      );
    }
    assert(
      operation.responses["429"]?.headers?.["Retry-After"]?.schema,
      `${label}: retry header missing`,
    );
    if (route.guarded) {
      protectedRoutes++;
      assert(
        operation.responses["401"]?.content?.["application/json"]?.schema,
        `${label}: 401 schema missing`,
      );
    }
    // Missing credentials or invalid public bodies cannot reach a business write.
    const result = await app.inject({
      method: route.method.toUpperCase(),
      url: route.path.replace(
        /\{[^}]+\}/g,
        "11111111-1111-4111-8111-111111111111",
      ),
      ...(!["get", "head"].includes(route.method)
        ? {
            headers: { "content-type": media ?? "application/json" },
            payload:
              media === "image/jpeg" ? Buffer.from([255, 216, 255, 217]) : {},
          }
        : {}),
    });
    assert.equal(
      result.statusCode,
      route.guarded ? 401 : excluded.has(route.path) ? 200 : 400,
      `${label}: runtime status mismatch`,
    );
    if (result.statusCode >= 400) errorOutput.parse(result.json());
  }
  for (const [name, headers, payload, status, message] of [
    [
      "invalid JSON",
      { "content-type": "application/json" },
      "{",
      400,
      "No se pudo leer la solicitud. Revisa el formato de los datos.",
    ],
    [
      "unsupported media",
      { "content-type": "application/xml" },
      "<x/>",
      415,
      "El formato de la solicitud no está admitido.",
    ],
    [
      "oversized JPEG",
      { "content-type": "image/jpeg" },
      Buffer.alloc(524289),
      413,
      "El archivo o la solicitud supera el tamaño permitido.",
    ],
  ]) {
    const result = await app.inject({
      method: "POST",
      url:
        name === "oversized JPEG"
          ? "/api/v1/auth/me/avatar"
          : "/api/v1/auth/login",
      headers,
      payload,
    });
    assert.equal(result.statusCode, status, name);
    errorOutput.parse(result.json());
    assert.equal(result.json().message, message, name);
  }
  console.log(
    JSON.stringify({
      controllerRoutes: routes.length,
      documentedRoutes: documented.size,
      protectedRoutes,
      parserBoundaries: 3,
      verified: true,
    }),
  );
} finally {
  await app.close();
}
