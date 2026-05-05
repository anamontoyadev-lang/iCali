-- ============================================================
-- PORTAL iCALI — SCHEMA SUPABASE
-- Pegar completo en Supabase > SQL Editor > Run
-- ============================================================

-- ── EXTENSIONES ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── TABLA: perfiles de usuario (extiende auth.users) ────────
create table public.perfiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  nombre        text not null,
  apellido      text,
  email         text not null,
  rol           text not null default 'asesor' check (rol in ('admin','asesor','administrativo')),
  cedula        text,
  fecha_ingreso date,
  sede          text default 'iCali',
  activo        boolean default true,
  avatar_url    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── TABLA: asesores (detalle comercial) ─────────────────────
create table public.asesores (
  id            uuid default uuid_generate_v4() primary key,
  perfil_id     uuid references public.perfiles(id) on delete set null,
  nombre        text not null,
  nombre_recaudo text,                    -- nombre exacto en RptRecaudoDiario
  nombre_planilla text,                   -- nombre en planilla comisiones
  cedula        text,
  fecha_ingreso date,
  sede          text default 'iCali',
  activo        boolean default true,
  com_por_equipo numeric(10,0) default 20000,  -- comisión promedio histórica
  created_at    timestamptz default now()
);

-- ── TABLA: ventas mensuales (del RptRecaudoDiario) ───────────
create table public.ventas_mensuales (
  id            uuid default uuid_generate_v4() primary key,
  asesor_id     uuid references public.asesores(id) on delete cascade,
  año           int not null,
  mes           int not null check (mes between 1 and 12),
  equipos       int default 0,
  valor_total   numeric(15,0) default 0,
  ticket_prom   numeric(15,0) default 0,
  fuente        text default 'recaudo',   -- 'recaudo' | 'manual'
  uploaded_at   timestamptz default now(),
  uploaded_by   uuid references public.perfiles(id),
  constraint ventas_asesor_periodo unique (asesor_id, año, mes)
);

-- ── TABLA: metas por asesor por mes ─────────────────────────
create table public.metas (
  id            uuid default uuid_generate_v4() primary key,
  asesor_id     uuid references public.asesores(id) on delete cascade,
  año           int not null,
  mes           int not null check (mes between 1 and 12),
  meta_equipos  int default 0,
  meta_valor    numeric(15,0) default 0,
  meta_comision numeric(12,0) default 0,
  created_at    timestamptz default now(),
  updated_by    uuid references public.perfiles(id),
  constraint metas_asesor_periodo unique (asesor_id, año, mes)
);

-- ── TABLA: comisiones históricas (de planillas) ──────────────
create table public.comisiones (
  id            uuid default uuid_generate_v4() primary key,
  asesor_id     uuid references public.asesores(id) on delete cascade,
  año           int not null,
  mes           int not null check (mes between 1 and 12),
  equipos_com   int default 0,
  com_total     numeric(12,0) default 0,
  com_por_equipo numeric(10,0) default 0,
  fuente        text default 'planilla',
  uploaded_at   timestamptz default now(),
  constraint comisiones_asesor_periodo unique (asesor_id, año, mes)
);

-- ── TABLA: cuadres diarios de caja ──────────────────────────
create table public.cuadres_diarios (
  id              uuid default uuid_generate_v4() primary key,
  fecha           date not null unique,
  efectivo        numeric(15,0) default 0,
  transferencias  numeric(15,0) default 0,
  datafono_total  numeric(15,0) default 0,
  bb_total        numeric(15,0) default 0,
  addi_total      numeric(15,0) default 0,
  brilla_total    numeric(15,0) default 0,
  contraentrega   numeric(15,0) default 0,
  desc_datafono   numeric(12,0) default 0,   -- 4%
  desc_bb         numeric(12,0) default 0,   -- 5%
  ingreso_neto    numeric(15,0) generated always as
                  (efectivo + transferencias + datafono_total + bb_total +
                   addi_total + brilla_total + contraentrega +
                   desc_datafono + desc_bb) stored,
  diferencia      numeric(15,0) default 0,
  nota            text,
  cerrado_por     uuid references public.perfiles(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── TABLA: datáfono (transacciones con tarjeta) ──────────────
create table public.datafono (
  id            uuid default uuid_generate_v4() primary key,
  fecha         date not null,
  factura       text not null,
  valor_cliente numeric(12,0) not null,
  valor_neto    numeric(12,0) generated always as
                (case when franquicia = 'Bold' then valor_cliente
                 else round(valor_cliente / 1.04) end) stored,
  boucher       text,
  franquicia    text check (franquicia in ('Visa','Mastercard','Amex','Bold','Otro')),
  cuadre_id     uuid references public.cuadres_diarios(id),
  registrado_por uuid references public.perfiles(id),
  created_at    timestamptz default now()
);

-- ── TABLA: créditos Bancolombia ──────────────────────────────
create table public.creditos_bb (
  id            uuid default uuid_generate_v4() primary key,
  fecha         date not null,
  nombre_cliente text not null,
  factura       text,
  cedula        text,
  valor_factura numeric(12,0) not null,
  valor_neto    numeric(12,0) generated always as
                (round(valor_factura / 1.05)) stored,
  cuadre_id     uuid references public.cuadres_diarios(id),
  registrado_por uuid references public.perfiles(id),
  created_at    timestamptz default now()
);

-- ── TABLA: créditos ADDI ─────────────────────────────────────
create table public.creditos_addi (
  id            uuid default uuid_generate_v4() primary key,
  fecha         date not null,
  nombre_cliente text not null,
  factura       text,
  cedula        text,
  id_venta_addi text,
  valor_base    numeric(12,0) not null,
  valor_con_5   numeric(12,0) generated always as (round(valor_base * 1.05)) stored,
  valor_con_15  numeric(12,0) generated always as (round(valor_base * 1.15)) stored,
  cuadre_id     uuid references public.cuadres_diarios(id),
  registrado_por uuid references public.perfiles(id),
  created_at    timestamptz default now()
);

-- ── TABLA: créditos Brilla ───────────────────────────────────
create table public.creditos_brilla (
  id            uuid default uuid_generate_v4() primary key,
  fecha         date not null,
  nombre_cliente text not null,
  factura       text,
  cedula        text,
  valor_facturado numeric(12,0) not null,
  valor_base    numeric(12,0) generated always as
                (round(valor_facturado / 1.2)) stored,
  cuadre_id     uuid references public.cuadres_diarios(id),
  registrado_por uuid references public.perfiles(id),
  created_at    timestamptz default now()
);

-- ── TABLA: pendientes (separados, préstamos, faltantes) ──────
create table public.pendientes (
  id              uuid default uuid_generate_v4() primary key,
  fecha_registro  date not null default current_date,
  asesor_id       uuid references public.asesores(id),
  tipo            text not null check (tipo in
                  ('SEPARADO/ABONO','PRÉSTAMO INTERNO','FALTANTE','MONEDAS','SOBRANTE')),
  cliente_desc    text not null,
  factura         text,
  valor_original  numeric(12,0) not null,
  valor_abonado   numeric(12,0) default 0,
  saldo           numeric(12,0) generated always as
                  (valor_original - valor_abonado) stored,
  fecha_vence     date,
  estado          text default 'PENDIENTE' check (estado in
                  ('PENDIENTE','ABONANDO','PAGADO','INCOBRABLE')),
  observaciones   text,
  autorizado_por  uuid references public.perfiles(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── TABLA: abonos de pendientes ──────────────────────────────
create table public.abonos (
  id            uuid default uuid_generate_v4() primary key,
  pendiente_id  uuid references public.pendientes(id) on delete cascade,
  fecha         date not null default current_date,
  valor         numeric(12,0) not null,
  nota          text,
  registrado_por uuid references public.perfiles(id),
  created_at    timestamptz default now()
);

-- ── TABLA: contraentregas ────────────────────────────────────
create table public.contraentregas (
  id              uuid default uuid_generate_v4() primary key,
  fecha_envio     date not null,
  factura         text,
  valor           numeric(12,0) not null,
  producto        text,
  guia            text,
  transportadora  text default 'Coordinadora' check
                  (transportadora in ('Coordinadora','Interrapidísimo','Otro')),
  asesor_id       uuid references public.asesores(id),
  estado          text default 'EN_TRANSITO' check (estado in
                  ('EN_TRANSITO','ENTREGADO','CANCELADO','NOVEDAD','DEVUELTO')),
  fecha_entrega   date,
  observaciones   text,
  registrado_por  uuid references public.perfiles(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── TABLA: horas extras ──────────────────────────────────────
create table public.horas_extras (
  id            uuid default uuid_generate_v4() primary key,
  asesor_id     uuid references public.asesores(id) on delete cascade,
  fecha         date not null,
  minutos       int not null check (minutos >= 0),
  valor_hora    numeric(10,0) default 20000,
  valor_pago    numeric(10,0) generated always as
                (round((minutos::numeric / 60) * valor_hora)) stored,
  registrado_por uuid references public.perfiles(id),
  created_at    timestamptz default now(),
  constraint he_asesor_dia unique (asesor_id, fecha)
);

-- ── TABLA: uploads de archivos ───────────────────────────────
create table public.uploads (
  id            uuid default uuid_generate_v4() primary key,
  tipo          text not null check (tipo in ('recaudo','comisiones','cuadre')),
  nombre_archivo text not null,
  año           int,
  mes           int,
  filas_procesadas int default 0,
  errores       int default 0,
  subido_por    uuid references public.perfiles(id),
  created_at    timestamptz default now()
);

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- Vista: resumen ventas por asesor y período
create or replace view public.v_ventas_resumen as
select
  a.nombre,
  a.sede,
  vm.año,
  vm.mes,
  vm.equipos,
  vm.valor_total,
  vm.ticket_prom,
  coalesce(m.meta_equipos, 0) as meta_equipos,
  coalesce(m.meta_valor, 0)   as meta_valor,
  coalesce(m.meta_comision, 0) as meta_comision,
  case when coalesce(m.meta_equipos,0) > 0
       then round((vm.equipos::numeric / m.meta_equipos) * 100, 1)
       else null end as pct_equipos,
  case when coalesce(m.meta_valor,0) > 0
       then round((vm.valor_total::numeric / m.meta_valor) * 100, 1)
       else null end as pct_valor
from public.ventas_mensuales vm
join public.asesores a on a.id = vm.asesor_id
left join public.metas m on m.asesor_id = vm.asesor_id
  and m.año = vm.año and m.mes = vm.mes;

-- Vista: pendientes activos con saldo
create or replace view public.v_pendientes_activos as
select
  p.*,
  a.nombre as asesor_nombre,
  case when p.fecha_vence < current_date and p.estado = 'PENDIENTE'
       then true else false end as vencido
from public.pendientes p
left join public.asesores a on a.id = p.asesor_id
where p.estado in ('PENDIENTE','ABONANDO')
order by p.fecha_vence asc nulls last;

-- Vista: cuadre diario con totales
create or replace view public.v_cuadre_mes as
select
  date_trunc('month', fecha) as mes,
  count(*) as dias_cuadrados,
  sum(efectivo) as total_efectivo,
  sum(transferencias) as total_transferencias,
  sum(datafono_total) as total_datafono,
  sum(bb_total) as total_bb,
  sum(addi_total) as total_addi,
  sum(brilla_total) as total_brilla,
  sum(ingreso_neto) as total_neto,
  sum(diferencia) as diferencia_acumulada
from public.cuadres_diarios
group by date_trunc('month', fecha)
order by mes desc;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.perfiles           enable row level security;
alter table public.asesores           enable row level security;
alter table public.ventas_mensuales   enable row level security;
alter table public.metas              enable row level security;
alter table public.comisiones         enable row level security;
alter table public.cuadres_diarios    enable row level security;
alter table public.datafono           enable row level security;
alter table public.creditos_bb        enable row level security;
alter table public.creditos_addi      enable row level security;
alter table public.creditos_brilla    enable row level security;
alter table public.pendientes         enable row level security;
alter table public.abonos             enable row level security;
alter table public.contraentregas     enable row level security;
alter table public.horas_extras       enable row level security;
alter table public.uploads            enable row level security;

-- Función helper: obtener rol del usuario actual
create or replace function public.get_my_role()
returns text language sql security definer as $$
  select rol from public.perfiles where id = auth.uid();
$$;

-- Función helper: obtener asesor_id del usuario actual
create or replace function public.get_my_asesor_id()
returns uuid language sql security definer as $$
  select id from public.asesores where perfil_id = auth.uid();
$$;

-- ── Políticas: perfiles ──────────────────────────────────────
create policy "perfiles_read_own" on public.perfiles
  for select using (id = auth.uid() or get_my_role() = 'admin');

create policy "perfiles_update_own" on public.perfiles
  for update using (id = auth.uid());

create policy "perfiles_admin_all" on public.perfiles
  for all using (get_my_role() = 'admin');

-- ── Políticas: asesores ──────────────────────────────────────
create policy "asesores_read_all" on public.asesores
  for select using (auth.uid() is not null);

create policy "asesores_admin_write" on public.asesores
  for all using (get_my_role() = 'admin');

-- ── Políticas: ventas (asesor ve solo las suyas) ─────────────
create policy "ventas_read" on public.ventas_mensuales
  for select using (
    get_my_role() = 'admin' or
    asesor_id = get_my_asesor_id()
  );

create policy "ventas_admin_write" on public.ventas_mensuales
  for all using (get_my_role() = 'admin');

-- ── Políticas: metas ─────────────────────────────────────────
create policy "metas_read" on public.metas
  for select using (
    get_my_role() = 'admin' or
    asesor_id = get_my_asesor_id()
  );

create policy "metas_admin_write" on public.metas
  for all using (get_my_role() = 'admin');

-- ── Políticas: comisiones ────────────────────────────────────
create policy "comisiones_read" on public.comisiones
  for select using (
    get_my_role() = 'admin' or
    asesor_id = get_my_asesor_id()
  );

create policy "comisiones_admin_write" on public.comisiones
  for all using (get_my_role() = 'admin');

-- ── Políticas: cuadre (solo admin) ──────────────────────────
create policy "cuadre_admin_only" on public.cuadres_diarios
  for all using (get_my_role() = 'admin');

create policy "datafono_admin" on public.datafono
  for all using (get_my_role() = 'admin');

create policy "bb_admin" on public.creditos_bb
  for all using (get_my_role() = 'admin');

create policy "addi_admin" on public.creditos_addi
  for all using (get_my_role() = 'admin');

create policy "brilla_admin" on public.creditos_brilla
  for all using (get_my_role() = 'admin');

-- ── Políticas: pendientes ────────────────────────────────────
create policy "pendientes_read" on public.pendientes
  for select using (
    get_my_role() = 'admin' or
    asesor_id = get_my_asesor_id()
  );

create policy "pendientes_insert_asesor" on public.pendientes
  for insert with check (
    get_my_role() = 'admin' or
    asesor_id = get_my_asesor_id()
  );

create policy "pendientes_admin_write" on public.pendientes
  for update using (get_my_role() = 'admin');

-- ── Políticas: abonos ────────────────────────────────────────
create policy "abonos_read" on public.abonos
  for select using (
    get_my_role() = 'admin' or
    exists (
      select 1 from public.pendientes p
      where p.id = pendiente_id and p.asesor_id = get_my_asesor_id()
    )
  );

create policy "abonos_admin_write" on public.abonos
  for all using (get_my_role() = 'admin');

-- ── Políticas: contraentregas ────────────────────────────────
create policy "contraentregas_read" on public.contraentregas
  for select using (
    get_my_role() = 'admin' or
    asesor_id = get_my_asesor_id()
  );

create policy "contraentregas_insert" on public.contraentregas
  for insert with check (auth.uid() is not null);

create policy "contraentregas_admin_update" on public.contraentregas
  for update using (get_my_role() = 'admin');

-- ── Políticas: horas extras ──────────────────────────────────
create policy "he_read" on public.horas_extras
  for select using (
    get_my_role() = 'admin' or
    asesor_id = get_my_asesor_id()
  );

create policy "he_insert" on public.horas_extras
  for insert with check (
    get_my_role() = 'admin' or
    asesor_id = get_my_asesor_id()
  );

create policy "he_admin_update" on public.horas_extras
  for update using (get_my_role() = 'admin');

-- ── Políticas: uploads ───────────────────────────────────────
create policy "uploads_read" on public.uploads
  for select using (auth.uid() is not null);

create policy "uploads_admin" on public.uploads
  for all using (get_my_role() = 'admin');

-- ============================================================
-- TRIGGER: crear perfil automáticamente al registrar usuario
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.perfiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'rol', 'asesor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TRIGGER: actualizar updated_at automáticamente
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_perfiles
  before update on public.perfiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at_cuadres
  before update on public.cuadres_diarios
  for each row execute function public.set_updated_at();

create trigger set_updated_at_pendientes
  before update on public.pendientes
  for each row execute function public.set_updated_at();

create trigger set_updated_at_contraentregas
  before update on public.contraentregas
  for each row execute function public.set_updated_at();

-- ============================================================
-- DATOS INICIALES: asesores iCali
-- ============================================================
insert into public.asesores
  (nombre, nombre_recaudo, nombre_planilla, cedula, fecha_ingreso, sede, com_por_equipo)
values
  ('Valentina Arcila',    'VALENTINA  ARCILA',    'VALEN',    '1114148729', '2025-02-21', 'iCali', 22000),
  ('Alexandra Gue',       'ALEXANDRA  GUE',        'ALEXA',    '1109660071', '2025-04-01', 'iCali', 20000),
  ('Alejandro Mendoza',   'ALEJANDRO  MENDOZA',    'ALEJO',    '1005894812', '2025-02-24', 'iCali', 20000),
  ('Sofía Calero',        'SOFIA  CALERO',         'SOFIA',    '1193578094', '2024-10-21', 'iCali', 20000),
  ('Brayan Ordóñez',      'BRAYAN  ORDONEZ',       'BRIAN O.', '1006054154', '2025-04-08', 'iCali', 30000),
  ('Kevin Giraldo',       'KEVIN  GIRALDO',        'KEVIN',    '1151935958', '2025-04-20', 'iCali', 30000),
  ('Steffany Sánchez',    'STEFFANY  SANCHEZ',     'STEFF',    '1144186516', '2024-06-24', 'iCali', 20000),
  ('Felipe Tawil',        'FELIPE  TAWIL',         'TAWIL',    '16227959',   '2025-03-15', 'iCali', 15000),
  ('Carlos Bermúdez',     'CARLOS  BARRERA',       'CARLOS',   '1130602293', '2026-01-16', 'iCali', 30000),
  ('Sergio Posada',       'SERGIO  POSADA',        'SERGIO',   '1144186392', '2024-05-27', 'iCali', 25000),
  ('Santiago Coral',      'SANTIAGO  CORAL',       'SANTIAGO', null,         null,         'iCali', 15000),
  ('Brayan Salazar',      'BRAYAN  SALAZAR',       'BRAYAN',   '1107096792', '2022-02-02', 'iCali', 12000),
  ('Paula Trujillo',      null,                    'PAULA',    '1143877563', '2024-11-03', 'iCali', 20000),
  ('Carolina Bolaños',    null,                    'CAROLINA', '1088598652', '2025-08-08', 'iCali', 20000),
  ('María Alejandra Del Río', null,                'MALEJA',   '1144034394', '2025-11-04', 'iCali', 15000),
  ('Laura Muriel',        null,                    'LAURA',    '1101852358', '2025-11-28', 'iCali', 15000),
  ('Emanuel Castaño',     null,                    'EMANUEL',  '1107512483', '2025-08-04', 'iCali', 20000),
  ('Alberto Bustamante',  null,                    'ALBERTO',  '1144051135', '2026-03-24', 'iCali', 30000),
  ('Diego Gómez',         null,                    null,       '1110286538', '2025-04-05', 'iCali', 20000),
  ('Diana Robayo',        null,                    null,       '1151952343', '2025-05-01', 'iCali', 20000),
  ('Alejandro Antolinez', 'ALEJANDRO  ANTOLINEZ',  null,       '1144079822', '2025-07-11', 'iCali', 15000);

-- ============================================================
-- FIN DEL SCHEMA
-- ============================================================
