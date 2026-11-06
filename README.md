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

1. **Supabase → SQL Editor:** pegar `supabase.sql` completo y ejecutarlo una vez.
2. **Supabase → Authentication → Users → Add user:** crear la cuenta de cada lector (correo y contraseña, con *Auto Confirm User*).
3. **Supabase → Authentication → Sign In / Providers:** desactivar *Allow new users to sign up*, para que solo entren las cuentas creadas en el paso 2.
4. **`config.js`:** poner la *Project URL* y la clave *publishable* (o *anon*) de **Project Settings → API**. Nunca la clave *secret* / *service_role*.
5. **Vercel → Add New → Project:** importar este repositorio, sin cambiar nada, y pulsar *Deploy*.

## Quién puede hacer qué

- **Cualquiera con el enlace:** ver el estante, las reseñas y abrir los audiolibros.
- **Con sesión iniciada:** agregar, editar y eliminar libros, subir portadas y marcar el avance.
- **Cada persona:** solo puede escribir o borrar su propia reseña.
