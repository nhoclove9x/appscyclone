import { Pool } from "pg";
import type { QueryResultRow } from "pg";

interface NamedRow extends QueryResultRow {
  name: string;
}

interface ColumnRow extends QueryResultRow {
  column_name: string;
  data_type: string;
  is_nullable: "NO" | "YES";
  numeric_precision: number | null;
  numeric_scale: number | null;
}

interface ForeignKeyRow extends QueryResultRow {
  name: string;
  delete_action: string;
  update_action: string;
}

interface PrimaryKeyRow extends QueryResultRow {
  table_name: string;
  columns: string[];
}

function databaseUrl(): string {
  const value = process.env.DATABASE_URL;

  if (value === undefined || value.length === 0) {
    throw new Error("DATABASE_URL is required for schema integration tests");
  }

  return value;
}

describe("PostgreSQL schema", () => {
  const pool = new Pool({ connectionString: databaseUrl() });

  afterAll(async () => {
    await pool.end();
  });

  it("has the expected application and session tables", async () => {
    const result = await pool.query<NamedRow>(`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    expect(result.rows.map(({ name }) => name)).toEqual([
      "_prisma_migrations",
      "application_state",
      "datasets",
      "price_snapshots",
      "prices",
      "session",
      "trades",
      "users",
    ]);
  });

  it("uses the exact connect-pg-simple session columns", async () => {
    const result = await pool.query<ColumnRow>(`
      SELECT column_name, data_type, is_nullable,
             numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'session'
      ORDER BY ordinal_position
    `);

    expect(result.rows).toEqual([
      expect.objectContaining({
        column_name: "sid",
        data_type: "character varying",
        is_nullable: "NO",
      }),
      expect.objectContaining({
        column_name: "sess",
        data_type: "json",
        is_nullable: "NO",
      }),
      expect.objectContaining({
        column_name: "expire",
        data_type: "timestamp without time zone",
        is_nullable: "NO",
      }),
    ]);
  });

  it("uses NUMERIC(38,18) for every financial column", async () => {
    const result = await pool.query<ColumnRow>(`
      SELECT column_name, data_type, is_nullable,
             numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'prices' AND column_name = 'price_usd') OR
          (table_name = 'trades' AND column_name IN ('quantity', 'price_usd', 'fee_usd'))
        )
      ORDER BY table_name, ordinal_position
    `);

    expect(result.rows).toHaveLength(4);
    for (const column of result.rows) {
      expect(column).toEqual(
        expect.objectContaining({
          data_type: "numeric",
          is_nullable: "NO",
          numeric_precision: 38,
          numeric_scale: 18,
        }),
      );
    }
  });

  it("has the accepted composite primary keys", async () => {
    const result = await pool.query<PrimaryKeyRow>(`
      SELECT relation.relname AS table_name,
             ARRAY_AGG(attribute.attname::text ORDER BY key_column.ordinality) AS columns
      FROM pg_constraint AS constraint_definition
      JOIN pg_class AS relation ON relation.oid = constraint_definition.conrelid
      CROSS JOIN LATERAL UNNEST(constraint_definition.conkey)
        WITH ORDINALITY AS key_column(attribute_number, ordinality)
      JOIN pg_attribute AS attribute
        ON attribute.attrelid = relation.oid
       AND attribute.attnum = key_column.attribute_number
      WHERE constraint_definition.contype = 'p'
        AND relation.relname IN ('prices', 'trades')
      GROUP BY relation.relname
      ORDER BY relation.relname
    `);

    expect(result.rows).toEqual([
      { table_name: "prices", columns: ["snapshot_id", "symbol"] },
      { table_name: "trades", columns: ["dataset_id", "trade_id"] },
    ]);
  });

  it("uses restrictive actions for every financial-history foreign key", async () => {
    const result = await pool.query<ForeignKeyRow>(`
      SELECT conname AS name,
             confdeltype::text AS delete_action,
             confupdtype::text AS update_action
      FROM pg_constraint
      WHERE contype = 'f'
      ORDER BY conname
    `);

    expect(result.rows).toHaveLength(5);
    for (const foreignKey of result.rows) {
      expect(foreignKey.delete_action).toBe("r");
      expect(foreignKey.update_action).toBe("r");
    }
  });

  it("has all accepted checks and no speculative exchange/side indexes", async () => {
    const checks = await pool.query<NamedRow>(`
      SELECT constraint_definition.conname AS name
      FROM pg_constraint AS constraint_definition
      JOIN pg_class AS relation ON relation.oid = constraint_definition.conrelid
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE constraint_definition.contype = 'c'
        AND namespace.nspname = 'public'
      ORDER BY constraint_definition.conname
    `);
    const indexes = await pool.query<NamedRow>(`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY indexname
    `);

    expect(checks.rows.map(({ name }) => name)).toEqual([
      "application_state_singleton_check",
      "prices_price_usd_positive_check",
      "prices_symbol_nonempty_check",
      "trades_fee_usd_nonnegative_check",
      "trades_price_usd_positive_check",
      "trades_quantity_positive_check",
      "trades_source_row_number_check",
      "trades_symbol_nonempty_check",
      "trades_trade_id_nonempty_check",
    ]);

    const indexNames = indexes.rows.map(({ name }) => name);
    expect(indexNames).toEqual(
      expect.arrayContaining([
        "IDX_session_expire",
        "trades_dataset_symbol_time_idx",
        "trades_dataset_time_idx",
      ]),
    );
    expect(indexNames.some((name) => /exchange|side/i.test(name))).toBe(false);
  });

  it("enforces each accepted check constraint", async () => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO price_snapshots (
          id, as_of, source_filename, source_checksum
        ) VALUES (
          '00000000-0000-4000-8000-000000000001',
          '2026-03-31T23:59:59Z',
          'prices.csv',
          REPEAT('a', 64)
        )
      `);
      await client.query(`
        INSERT INTO datasets (
          id, source, source_filename, source_checksum,
          price_snapshot_id
        ) VALUES (
          '00000000-0000-4000-8000-000000000002',
          'SAMPLE',
          'trades.csv',
          REPEAT('b', 64),
          '00000000-0000-4000-8000-000000000001'
        )
      `);

      const invalidStatements = [
        {
          constraint: "prices_symbol_nonempty_check",
          sql: `INSERT INTO prices VALUES (
            '00000000-0000-4000-8000-000000000001', '  ', 1
          )`,
        },
        {
          constraint: "prices_price_usd_positive_check",
          sql: `INSERT INTO prices VALUES (
            '00000000-0000-4000-8000-000000000001', 'BTC', 0
          )`,
        },
        {
          constraint: "trades_trade_id_nonempty_check",
          sql: `INSERT INTO trades VALUES (
            '00000000-0000-4000-8000-000000000002', ' ', 2, NOW(),
            'Binance', 'BTC', 'BUY', 1, 1, 0
          )`,
        },
        {
          constraint: "trades_symbol_nonempty_check",
          sql: `INSERT INTO trades VALUES (
            '00000000-0000-4000-8000-000000000002', 'trade-1', 2, NOW(),
            'Binance', ' ', 'BUY', 1, 1, 0
          )`,
        },
        {
          constraint: "trades_source_row_number_check",
          sql: `INSERT INTO trades VALUES (
            '00000000-0000-4000-8000-000000000002', 'trade-1', 1, NOW(),
            'Binance', 'BTC', 'BUY', 1, 1, 0
          )`,
        },
        {
          constraint: "trades_quantity_positive_check",
          sql: `INSERT INTO trades VALUES (
            '00000000-0000-4000-8000-000000000002', 'trade-1', 2, NOW(),
            'Binance', 'BTC', 'BUY', 0, 1, 0
          )`,
        },
        {
          constraint: "trades_price_usd_positive_check",
          sql: `INSERT INTO trades VALUES (
            '00000000-0000-4000-8000-000000000002', 'trade-1', 2, NOW(),
            'Binance', 'BTC', 'BUY', 1, 0, 0
          )`,
        },
        {
          constraint: "trades_fee_usd_nonnegative_check",
          sql: `INSERT INTO trades VALUES (
            '00000000-0000-4000-8000-000000000002', 'trade-1', 2, NOW(),
            'Binance', 'BTC', 'BUY', 1, 1, -1
          )`,
        },
        {
          constraint: "application_state_singleton_check",
          sql: `INSERT INTO application_state VALUES (
            2, '00000000-0000-4000-8000-000000000002', NOW()
          )`,
        },
      ] as const;

      for (const { constraint, sql } of invalidStatements) {
        await client.query("SAVEPOINT invalid_value");
        await expect(client.query(sql)).rejects.toMatchObject({ constraint });
        await client.query("ROLLBACK TO SAVEPOINT invalid_value");
      }

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
