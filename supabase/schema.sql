-- ============================================================
-- Mi Depa — Schema completo
-- Pegar en: Supabase > SQL Editor > New query > Run
-- ============================================================

-- Apartments
CREATE TABLE apartments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL DEFAULT 'Mi Depa',
  rent          numeric NOT NULL DEFAULT 0,
  rent_currency text NOT NULL DEFAULT 'PEN',
  rent_exchange_rate numeric NOT NULL DEFAULT 3.80,
  maintenance   numeric NOT NULL DEFAULT 0,
  invite_code   text UNIQUE NOT NULL DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now()
);

-- Members (users que pertenecen a un apartment)
CREATE TABLE apartment_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id  uuid REFERENCES apartments(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  joined_at     timestamptz DEFAULT now(),
  UNIQUE(apartment_id, user_id)
);

-- Roommates (personas del depa — puede tener o no cuenta)
CREATE TABLE roommates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id  uuid REFERENCES apartments(id) ON DELETE CASCADE,
  name          text NOT NULL,
  income        numeric NOT NULL DEFAULT 0,
  color         text NOT NULL DEFAULT '#6366f1',
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- Expenses
CREATE TABLE expenses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id         uuid REFERENCES apartments(id) ON DELETE CASCADE,
  title                text NOT NULL,
  amount               numeric NOT NULL,
  category             text NOT NULL DEFAULT 'otros',
  paid_by              text NOT NULL,  -- roommate id
  date                 date NOT NULL,
  split_type           text NOT NULL DEFAULT 'equitativo',
  splits               jsonb NOT NULL DEFAULT '{}',
  calculated_shares    jsonb NOT NULL DEFAULT '{}',
  currency             text NOT NULL DEFAULT 'PEN',
  exchange_rate        numeric NOT NULL DEFAULT 1,
  recurrent_bill_id    uuid,
  recurrent_bill_month text,
  receipt_image        text,
  created_at           timestamptz DEFAULT now()
);

-- Recurrent bills
CREATE TABLE bills (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id         uuid REFERENCES apartments(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  amount               numeric NOT NULL,
  due_date             text,
  status               text NOT NULL DEFAULT 'por pagar',
  alert_sent           boolean NOT NULL DEFAULT false,
  notes                text,
  paid_by              text,
  split_type           text DEFAULT 'equitativo',
  splits               jsonb,
  associated_expense_id text,
  currency             text NOT NULL DEFAULT 'PEN',
  exchange_rate        numeric NOT NULL DEFAULT 1,
  category             text DEFAULT 'servicio',
  is_auto_debit        boolean NOT NULL DEFAULT false,
  deleted_at           text,
  created_at           timestamptz DEFAULT now()
);

-- Bill payment history
CREATE TABLE bill_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id    uuid REFERENCES apartments(id) ON DELETE CASCADE,
  bill_id         uuid REFERENCES bills(id) ON DELETE CASCADE,
  name            text,
  amount          numeric,
  due_date        text,
  notes           text,
  paid_by         text,
  split_type      text,
  splits          jsonb,
  currency        text DEFAULT 'PEN',
  exchange_rate   numeric DEFAULT 1,
  month_paid_for  text,
  date_paid       date,
  status          text DEFAULT 'pagado',
  category        text,
  is_auto_debit   boolean,
  created_at      timestamptz DEFAULT now()
);

-- Shopping items
CREATE TABLE shopping_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id  uuid REFERENCES apartments(id) ON DELETE CASCADE,
  name          text NOT NULL,
  quantity      text NOT NULL DEFAULT '1 u',
  checked       boolean NOT NULL DEFAULT false,
  added_by      text,
  created_at    timestamptz DEFAULT now()
);

-- Settlement records
CREATE TABLE settlements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id  uuid REFERENCES apartments(id) ON DELETE CASCADE,
  from_id       text NOT NULL,
  to_id         text NOT NULL,
  amount        numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'PEN',
  exchange_rate numeric NOT NULL DEFAULT 1,
  date          date NOT NULL,
  note          text,
  created_at    timestamptz DEFAULT now()
);

-- Forum posts
CREATE TABLE forum_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id  uuid REFERENCES apartments(id) ON DELETE CASCADE,
  author        text NOT NULL,
  title         text NOT NULL,
  content       text NOT NULL,
  type          text NOT NULL DEFAULT 'tip',
  created_at    timestamptz DEFAULT now()
);

-- Forum replies
CREATE TABLE forum_replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid REFERENCES forum_posts(id) ON DELETE CASCADE,
  author     text NOT NULL,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE apartments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies    ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a member of this apartment?
CREATE OR REPLACE FUNCTION is_member(apt_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM apartment_members
    WHERE apartment_id = apt_id AND user_id = auth.uid()
  );
$$;

-- Apartments: visible and editable if you're a member or the creator
CREATE POLICY "members can read"   ON apartments FOR SELECT USING (is_member(id));
CREATE POLICY "members can update" ON apartments FOR UPDATE USING (is_member(id));
CREATE POLICY "owner can insert"   ON apartments FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Apartment members
CREATE POLICY "members can read"   ON apartment_members FOR SELECT USING (is_member(apartment_id));
CREATE POLICY "members can insert" ON apartment_members FOR INSERT WITH CHECK (auth.uid() = user_id OR is_member(apartment_id));
CREATE POLICY "self can delete"    ON apartment_members FOR DELETE USING (user_id = auth.uid());

-- All other tables: full access if you're a member
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['roommates','expenses','bills','bill_history','shopping_items','settlements','forum_posts'] LOOP
    EXECUTE format('CREATE POLICY "members full access" ON %I FOR ALL USING (is_member(apartment_id)) WITH CHECK (is_member(apartment_id))', t);
  END LOOP;
END $$;

CREATE POLICY "members can access replies" ON forum_replies FOR ALL
  USING (EXISTS (SELECT 1 FROM forum_posts WHERE id = post_id AND is_member(apartment_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM forum_posts WHERE id = post_id AND is_member(apartment_id)));
