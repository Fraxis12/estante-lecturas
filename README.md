# Estante de Lecturas

Los libros que vamos leyendo, escuchando y reseñando: portadas, playlists de audiolibro, avance de lectura y reseñas con estrellas.

Sitio estático (HTML, CSS y JavaScript sin compilación) con [Supabase](https://supabase.com) como base de datos, inicio de sesión y almacenamiento de portadas. Se publica en [Vercel](https://vercel.com).

## Archivos

| Archivo | Qué contiene |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Diseño |
| `app.js` | Lógica: estante, fichas, reseñas, audiolibros, sesión |
| `config.js` | URL y clave pública de Supabase |
| `supabase.sql` | Tablas, reglas de seguridad y bucket de portadas |

## Puesta en marcha

1. **Supabase → SQL Editor:** pegar `supabase.sql` completo y ejecutarlo una vez. (Si ya se había ejecutado una versión anterior, correr también los archivos de `migraciones/`.)
2. **Supabase → Authentication → Sign In / Providers:** activar *Allow new users to sign up* para que cada lector cree su cuenta desde la página. *Confirm email* decide si deben abrir un enlace en su correo antes de entrar.
3. **Supabase → Authentication → URL Configuration:** poner la dirección de Vercel en *Site URL* (la usan los correos de confirmación y de recuperar contraseña).
4. **`config.js`:** poner la *Project URL* y la clave *publishable* (o *anon*) de **Project Settings → API**. Nunca la clave *secret* / *service_role*.
5. **Vercel → Add New → Project:** importar este repositorio, sin cambiar nada, y pulsar *Deploy*.

## Quién puede hacer qué

Cada cuenta tiene su **propio estante**: libros, avance, reseñas y notas solo los ve y los cambia su dueño (lo imponen las reglas de la base de datos, no solo la página). Sin sesión se muestra únicamente la bienvenida para entrar o crear cuenta. Las portadas se guardan con nombres aleatorios en un bucket público.
