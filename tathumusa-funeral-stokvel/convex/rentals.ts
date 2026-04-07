import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("rentals").collect();
  },
});

export const create = mutation({
  args: {
    memberName: v.string(),
    type: v.union(v.literal("car"), v.literal("equipment")),
    item: v.string(),
    date: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("rentals", {
      memberName: args.memberName,
      type: args.type,
      item: args.item,
      date: args.date,
      notes: args.notes,
      status: "pending",
    });
  },
});

export const remove = mutation({
  args: { rentalId: v.id("rentals") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.rentalId);
  },
});
