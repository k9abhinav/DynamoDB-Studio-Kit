import {
  AuthType,
  CreateConnectionBody,
  EnvTag,
  TestConnectionBody,
  interpretEndpoint,
  type AuthBody,
  type CreateConnectionBodyInput,
  type TestConnectionBodyInput,
} from "@dynamo-studio/shared";
import { z } from "zod";

export const CONNECT_DEBOUNCE_MS = 400;

export const ConnectFormSchema = z
  .strictObject({
    endpoint: z.string().max(2048),
    region: z.string().trim().min(1, "Enter a region.").max(64),
    authType: AuthType,
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    sessionToken: z.string(),
    profile: z.string(),
    name: z.string().max(128),
    env: EnvTag,
    readOnly: z.boolean(),
    remember: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const interpreted = interpretEndpoint(value.endpoint);
    if (interpreted.error !== undefined) {
      ctx.addIssue({ code: "custom", path: ["endpoint"], message: interpreted.error });
    }
    if (value.endpoint.trim().length === 0 && value.authType === "local") {
      ctx.addIssue({
        code: "custom",
        path: ["authType"],
        message: "Local auth needs an endpoint. Use Default credential chain for AWS.",
      });
    }
    if (value.authType === "keys") {
      if (value.accessKeyId.trim().length === 0) {
        ctx.addIssue({ code: "custom", path: ["accessKeyId"], message: "Enter an access key ID." });
      }
      if (value.secretAccessKey.trim().length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["secretAccessKey"],
          message: "Enter a secret access key.",
        });
      }
    }
    if (value.authType === "profile" && value.profile.trim().length === 0) {
      ctx.addIssue({ code: "custom", path: ["profile"], message: "Enter a profile name." });
    }
  });

export type ConnectFormValues = z.infer<typeof ConnectFormSchema>;

export const connectDefaults: ConnectFormValues = {
  endpoint: "",
  region: "us-east-1",
  authType: "default-chain",
  accessKeyId: "",
  secretAccessKey: "",
  sessionToken: "",
  profile: "",
  name: "",
  env: "dev",
  readOnly: false,
  remember: false,
};

export interface FieldTouches {
  auth: boolean;
  env: boolean;
  region: boolean;
}

export function applyUntouchedDefaults(
  values: ConnectFormValues,
  touched: FieldTouches,
): ConnectFormValues {
  const interpreted = interpretEndpoint(values.endpoint);
  return {
    ...values,
    authType: touched.auth ? values.authType : interpreted.suggestedAuth,
    env: touched.env ? values.env : interpreted.suggestedEnv,
    region:
      !touched.region && interpreted.region !== undefined ? interpreted.region : values.region,
  };
}

export function endpointLabel(values: ConnectFormValues): string {
  const interpreted = interpretEndpoint(values.endpoint);
  if (interpreted.endpoint !== undefined) {
    return interpreted.endpoint;
  }
  const raw = values.endpoint.trim();
  return raw.length === 0 ? "the endpoint" : raw;
}

function toAuth(values: ConnectFormValues): AuthBody {
  if (values.authType === "local") {
    return { type: "local" };
  }
  if (values.authType === "profile") {
    return { type: "profile", profile: values.profile.trim() };
  }
  if (values.authType === "keys") {
    const sessionToken = values.sessionToken.trim();
    return {
      type: "keys",
      accessKeyId: values.accessKeyId.trim(),
      secretAccessKey: values.secretAccessKey.trim(),
      ...(sessionToken.length === 0 ? {} : { sessionToken }),
    };
  }
  return { type: "default-chain" };
}

export function toCreateBody(values: ConnectFormValues): CreateConnectionBodyInput {
  const interpreted = interpretEndpoint(values.endpoint);
  const name = values.name.trim();
  return CreateConnectionBody.parse({
    region: values.region,
    auth: toAuth(values),
    env: values.env,
    readOnly: values.readOnly,
    remember: values.remember,
    ...(interpreted.endpoint === undefined ? {} : { endpoint: interpreted.endpoint }),
    ...(name.length === 0 ? {} : { name }),
  });
}

export function toTestBody(values: ConnectFormValues): TestConnectionBodyInput {
  const interpreted = interpretEndpoint(values.endpoint);
  return TestConnectionBody.parse({
    region: values.region,
    auth: toAuth(values),
    ...(interpreted.endpoint === undefined ? {} : { endpoint: interpreted.endpoint }),
  });
}
