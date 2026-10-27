import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import * as schema from "./schema";

// Concrete production type (D1). Tests reuse this type via a single cast in
// test setup so route code is shared and identically typed.
export type AppDb = ReturnType<typeof drizzleD1<typeof schema>>;

export { schema };
