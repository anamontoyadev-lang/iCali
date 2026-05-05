# Portal iCali — Guía de instalación

## Lo que ya tienes listo
- Proyecto Supabase creado: rkejcjfczpatvgirgyza
- Credenciales configuradas en el código
- Falta: ejecutar el schema SQL en Supabase
- Falta: subir el código a GitHub + Vercel

## PASO 1 — Schema en Supabase (5 min)
1. Abre https://supabase.com > tu proyecto
2. SQL Editor > New query
3. Pega TODO el contenido de supabase_schema.sql
4. Click Run — debe decir "Success. No rows returned"
5. Verifica en Table Editor que ves las tablas: asesores, perfiles, ventas_mensuales, etc.

## PASO 2 — Tu usuario admin (2 min)
1. Authentication > Users > Add user > Create new user
2. Email: tu correo · Password: la que quieras
3. SQL Editor > New query:

UPDATE public.perfiles SET rol = 'admin', nombre = 'Julian' WHERE email = 'tu@correo.com';

## PASO 3 — GitHub (10 min)
1. Instala Git desde https://git-scm.com si no lo tienes
2. github.com > New repository > nombre: icali-portal > Public > Create
3. Terminal en la carpeta icali-portal:
   git init
   git add .
   git commit -m "Portal iCali v1"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/icali-portal.git
   git push -u origin main

## PASO 4 — Vercel (5 min)
1. vercel.com > Sign up with GitHub
2. Add New > Project > selecciona icali-portal > Import
3. Environment Variables:
   REACT_APP_SUPABASE_URL = https://rkejcjfczpatvgirgyza.supabase.co
   REACT_APP_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZWpjamZjenBhdHZnaXJneXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMDczNjMsImV4cCI6MjA5MzU4MzM2M30.lHTAxwiougaVQHHB8cozpizDv8pdQhydaisTeUbdkNs
4. Click Deploy > en 2-3 min el portal está en vivo

## PASO 5 — Crear cuentas asesores
Authentication > Users > Add user por cada asesor.
Actualizar nombre:
UPDATE public.perfiles SET nombre='Valentina', apellido='Arcila' WHERE email='valentina@icali.co';
Vincular con tabla asesores:
UPDATE public.asesores SET perfil_id=(SELECT id FROM public.perfiles WHERE email='valentina@icali.co') WHERE nombre='Valentina Arcila';

## Probar local (opcional)
npm install
npm start
→ abre en http://localhost:3000

## Dashboard Supabase
https://supabase.com/dashboard/project/rkejcjfczpatvgirgyza
