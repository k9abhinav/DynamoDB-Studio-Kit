import { z } from "zod";
import { Item } from "./attribute.js";

const hash = z.string().min(1).max(128);

export const GetItemRequest = z.strictObject({
  key: Item,
});

export const GetItemResponse = z.strictObject({
  item: Item.nullable(),
});

export const PutItemRequest = z.strictObject({
  item: Item,
  ifNotExists: z.boolean().optional(),
  expectedHash: hash.optional(),
});

export const ItemWriteResponse = z.strictObject({
  item: Item,
  hash,
  weakConcurrency: z.boolean().optional(),
});

export const UpdateItemRequest = z.strictObject({
  key: Item,
  item: Item,
  expectedHash: hash.optional(),
});

export const DeleteItemRequest = z.strictObject({
  key: Item,
  expectedHash: hash.optional(),
});

export const DeleteItemResponse = z.strictObject({
  deleted: z.boolean(),
  previousItem: Item.optional(),
});

export type GetItemRequest = z.infer<typeof GetItemRequest>;
export type GetItemResponse = z.infer<typeof GetItemResponse>;
export type PutItemRequest = z.infer<typeof PutItemRequest>;
export type ItemWriteResponse = z.infer<typeof ItemWriteResponse>;
export type UpdateItemRequest = z.infer<typeof UpdateItemRequest>;
export type DeleteItemRequest = z.infer<typeof DeleteItemRequest>;
export type DeleteItemResponse = z.infer<typeof DeleteItemResponse>;
