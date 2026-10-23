import StorageOutlined from "@mui/icons-material/StorageOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateConnectionResponse,
  TestConnectionResponse,
  interpretEndpoint,
} from "@dynamo-studio/shared";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { api, ApiError } from "../../lib/api.js";
import { errorCopy } from "../../lib/error-copy.js";
import {
  CONNECT_DEBOUNCE_MS,
  ConnectFormSchema,
  applyUntouchedDefaults,
  connectDefaults,
  endpointLabel,
  toCreateBody,
  toTestBody,
  type ConnectFormValues,
  type FieldTouches,
} from "./connection-form.js";

const resolver = zodResolver(ConnectFormSchema) as Resolver<ConnectFormValues>;

export function ConnectCard({
  notice,
  onConnected,
}: {
  notice: string | null;
  onConnected: (connectionId: string) => void;
}) {
  const endpointRef = useRef<HTMLInputElement | null>(null);
  const touched = useRef<FieldTouches>({ auth: false, env: false, region: false });
  const abortRef = useRef<AbortController | null>(null);
  const [more, setMore] = useState(false);
  const [pending, setPending] = useState<"test" | "connect" | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = useForm<ConnectFormValues>({
    resolver,
    defaultValues: connectDefaults,
    mode: "onSubmit",
  });
  const endpoint = useWatch({ control, name: "endpoint" });
  const authType = useWatch({ control, name: "authType" });

  useEffect(() => {
    endpointRef.current?.focus();
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const interpreted = interpretEndpoint(endpoint);
      if (interpreted.error !== undefined) {
        setError("endpoint", { message: interpreted.error });
      } else {
        clearErrors("endpoint");
      }
      if (!touched.current.auth) {
        setValue("authType", interpreted.suggestedAuth);
      }
      if (!touched.current.env) {
        setValue("env", interpreted.suggestedEnv);
      }
      if (!touched.current.region && interpreted.region !== undefined) {
        setValue("region", interpreted.region);
      }
    }, CONNECT_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [clearErrors, endpoint, setError, setValue]);

  async function submit(kind: "test" | "connect", values: ConnectFormValues) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(kind);
    setRequestError(null);
    const next = applyUntouchedDefaults(values, touched.current);
    try {
      if (kind === "test") {
        const result = await api("/api/v1/connections/test", {
          method: "POST",
          body: toTestBody(next),
          schema: TestConnectionResponse,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setTestMessage(`Connected in ${String(result.latencyMs)} ms`);
        }
      } else {
        const result = await api("/api/v1/connections", {
          method: "POST",
          body: toCreateBody(next),
          schema: CreateConnectionResponse,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          onConnected(result.connectionId);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setTestMessage(null);
        setRequestError(messageFor(error, endpointLabel(next)));
      }
    } finally {
      if (!controller.signal.aborted && abortRef.current === controller) {
        setPending(null);
      }
    }
  }

  return (
    <section className="w-full max-w-[480px] rounded-xl border border-outline bg-surface p-8">
      <div className="flex items-center gap-2">
        <StorageOutlined className="text-primary" />
        <h1 className="text-[28px] leading-9 font-normal">DynamoDB Studio</h1>
      </div>
      <p className="mt-2 text-sm text-text-secondary">Connect to a database</p>
      {notice === null ? null : (
        <Alert className="mt-6" severity="info">
          {notice}
        </Alert>
      )}
      <form
        className="mt-6 flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          void handleSubmit((values) => submit("connect", values))(event);
        }}
      >
        <Controller
          name="endpoint"
          control={control}
          render={({ field }) => (
            <TextField
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              fullWidth
              label="Endpoint"
              placeholder="http://localhost:8000"
              error={errors.endpoint !== undefined}
              helperText={errors.endpoint?.message}
              slotProps={{ input: { className: "rounded-full" } }}
              inputRef={(node: HTMLInputElement | null) => {
                field.ref(node);
                endpointRef.current = node;
              }}
              onChange={(event) => {
                field.onChange(event.target.value);
                setTestMessage(null);
                setRequestError(null);
              }}
            />
          )}
        />
        <Controller
          name="region"
          control={control}
          render={({ field }) => (
            <TextField
              label="Region"
              value={field.value}
              fullWidth
              error={errors.region !== undefined}
              helperText={errors.region?.message}
              onChange={(event) => {
                touched.current.region = true;
                field.onChange(event.target.value);
              }}
            />
          )}
        />
        <FormControl error={errors.authType !== undefined}>
          <FormLabel id="auth-label">Auth</FormLabel>
          <Controller
            name="authType"
            control={control}
            render={({ field }) => (
              <RadioGroup
                aria-labelledby="auth-label"
                value={field.value}
                onChange={(event) => {
                  touched.current.auth = true;
                  field.onChange(event.target.value);
                }}
              >
                <FormControlLabel value="local" control={<Radio />} label="Local" />
                <FormControlLabel value="keys" control={<Radio />} label="Access keys" />
                <FormControlLabel value="profile" control={<Radio />} label="Profile" />
                <FormControlLabel
                  value="default-chain"
                  control={<Radio />}
                  label="Default credential chain"
                />
              </RadioGroup>
            )}
          />
          {errors.authType === undefined ? null : (
            <p className="text-sm text-error">{errors.authType.message}</p>
          )}
        </FormControl>
        {authType === "keys" ? (
          <>
            <TextField
              {...register("accessKeyId")}
              label="Access key ID"
              fullWidth
              error={errors.accessKeyId !== undefined}
              helperText={errors.accessKeyId?.message}
              autoComplete="off"
            />
            <TextField
              {...register("secretAccessKey")}
              label="Secret access key"
              type="password"
              fullWidth
              error={errors.secretAccessKey !== undefined}
              helperText={errors.secretAccessKey?.message}
              autoComplete="off"
            />
            <TextField
              {...register("sessionToken")}
              label="Session token"
              fullWidth
              autoComplete="off"
            />
          </>
        ) : null}
        {authType === "profile" ? (
          <TextField
            {...register("profile")}
            label="Profile name"
            fullWidth
            error={errors.profile !== undefined}
            helperText={errors.profile?.message}
            autoComplete="off"
          />
        ) : null}
        <div>
          <Button
            type="button"
            aria-expanded={more}
            onClick={() => {
              setMore((current) => !current);
            }}
          >
            More options
          </Button>
          <Collapse in={more}>
            <div className="flex flex-col gap-4 pt-3">
              <TextField {...register("name")} label="Name" fullWidth />
              <Controller
                name="env"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    label="Environment"
                    value={field.value}
                    fullWidth
                    onChange={(event) => {
                      touched.current.env = true;
                      field.onChange(event.target.value);
                    }}
                  >
                    <MenuItem value="local">Local</MenuItem>
                    <MenuItem value="dev">Dev</MenuItem>
                    <MenuItem value="staging">Staging</MenuItem>
                    <MenuItem value="production">Production</MenuItem>
                  </TextField>
                )}
              />
              <Controller
                name="readOnly"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(event) => {
                          field.onChange(event.target.checked);
                        }}
                      />
                    }
                    label="Read only"
                  />
                )}
              />
              <Controller
                name="remember"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(event) => {
                          field.onChange(event.target.checked);
                        }}
                      />
                    }
                    label="Remember"
                  />
                )}
              />
            </div>
          </Collapse>
        </div>
        {requestError === null ? null : <Alert severity="error">{requestError}</Alert>}
        {testMessage === null ? null : <Alert severity="success">{testMessage}</Alert>}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            disabled={pending !== null}
            onClick={() => {
              void handleSubmit((values) => submit("test", values))();
            }}
          >
            {pending === "test" ? "Testing" : "Test"}
          </Button>
          <Button type="submit" variant="contained" disabled={pending !== null}>
            {pending === "connect" ? "Connecting" : "Connect"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function messageFor(error: unknown, endpoint: string): string {
  if (error instanceof ApiError) {
    return errorCopy(error, endpoint);
  }
  return "Something went wrong.";
}
