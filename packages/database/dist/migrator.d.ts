import type pg from "pg";
export declare function runMigrations(pool: pg.Pool): Promise<void>;
