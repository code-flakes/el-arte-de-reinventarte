# Correo de bienvenida

- `bienvenida.html` — la plantilla, para abrir en el navegador y ver cómo queda.
  Lleva `{{nombre}}` y `{{baja}}` sin sustituir.
- `enviar-bienvenida.js` — el step que va después del intake: arma ese mismo
  HTML con los datos dentro y lo manda por Mailjet.

El HTML está duplicado a propósito: la plantilla es para mirarla, el step la
lleva incrustada para no depender de descargarla en el momento del envío. Si se
cambia una, hay que cambiar la otra.

## Entradas del step

| Entrada | De dónde viene |
|---|---|
| `enviar_bienvenida`, `para`, `nombre`, `contacto_id` | salida del step de intake |
| `apiKey`, `apiSecret` | Mailjet |
| `urlBaja` | obligatoria; sin ella el step lanza error y no manda |
| `remitente`, `remitenteNombre`, `imagen` | opcionales, con valor por defecto |

## Pendiente antes de enviar de verdad

1. **`assets/correo-bienvenida.jpg` no está publicado todavía.** Hasta que se
   despliegue, el correo sale con un hueco donde va la imagen.
2. **La URL de la imagen apunta a `elartedereinventarte.codeflakes.io`.** Si la
   landing cambia de dominio, hay que cambiarla (entrada `imagen`).
3. **`urlBaja`**: hay que decidir quién la genera. Mailjet la da en campañas,
   pero por la API de envío se pasa a mano, y tiene que ser única por persona.
4. **El pie enlaza a `elartereinventarte.com`**, que es lo que decía el texto
   original. Hoy el sitio vive en otro dominio.

## El enlace de baja

`enviar-bienvenida.js` arma el enlace y **se niega a devolver el correo si no puede**.
No es celo: la política publicada promete que se puede retirar el consentimiento «con el
enlace de baja de cada correo», y este correo es marketing. Sin enlace, esa frase es falsa.

El flujo tiene que pasar `inputs.tokenBaja` — el token opaco del contacto, que emite
PerfectFlow y viaja en la ficha. Con él se arma:

```
https://el-arte-de-reinventarte.perfectflow.cloud/baja/<token>
```

**No vale el correo ni el id en la URL.** Con el correo, cualquiera da de baja a cualquiera
probando direcciones; con el id, basta con contar.

También se devuelven `listUnsubscribe` y `listUnsubscribePost` para que el step de envío
las ponga como cabeceras. La primera es lo que convierte el «esto es spam» de Gmail en una
baja limpia; la segunda habilita el botón de un clic (RFC 8058).

### Lo que falta en PerfectFlow — ticket PF-10

**El endpoint `/baja/:token` todavía no existe.** `config/routes.rb` no tiene nada de baja,
así que hoy el enlace daría 404 y el flujo se para con el motivo a la vista. Eso es
deliberado: mejor parado que enviando sin enlace.

PF-10 tiene que resolver cuatro cosas:

1. **Un token por contacto**, opaco y no adivinable, expuesto por la API de automatización
   para que el flujo lo pueda leer.
2. **La baja marca la ficha**: `consentimiento = false` y `baja_fecha = hoy` — los dos
   campos ya existen en el seed de El Arte (`db/seeds/egda_elena.rb`).
3. **GET muestra una confirmación, POST ejecuta.** Los antivirus de correo abren los
   enlaces de los mensajes para analizarlos; si `GET /baja/<token>` diera de baja, se
   darían de baja solos contactos que nunca pulsaron nada. El botón de un clic de Gmail
   manda POST, así que la cabecera funciona igual.
4. **Idempotente.** Volver a entrar al enlace no debe fallar ni revertir nada.

Mientras PF-10 no exista, el flujo puede forzarse con `inputs.permitirSinBaja: true`, pero
eso es enviar marketing sin vía de baja y contradice la política publicada.

## El orden de los pasos

```
webhook de la landing  →  crear-lead.js  →  enviar-bienvenida.js  →  envío por Workspace
```

`crear-lead.js` va **primero** y no es opcional: sin él, quien se apunta recibe la
bienvenida y no existe en ninguna parte — no hay a quién dar de baja, no hay
consentimiento registrado, y la promesa de la política de guardar «la fecha de tu registro,
el hecho de que diste tu consentimiento y el momento en que lo hiciste, como prueba de que
el registro fue voluntario» no la cumple nadie.

Crea en el estado **`nuevo`** («Nuevo lead»), y lo manda explícito en vez de confiar en el
inicial por defecto: si mañana alguien reordena los estados en el CRM, el lead no se va en
silencio a otro sitio.

Necesita `inputs.tokenStation` — el `stations.automation_token` de El Arte — que va como
Basic Auth. Devuelve `tokenBaja` para el paso siguiente.

**Es idempotente por partida doble:** manda `Idempotency-Key`, y la deduplicación del CRM
responde 200 con la ficha que ya existía en vez de crear otra. Un reintento del flujo no
duplica a nadie.
