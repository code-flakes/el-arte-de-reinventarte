// Arma el correo de bienvenida y lo devuelve listo. NO envía: eso lo hace el
// step de correo que va después —la cuenta de Google Workspace del cliente—,
// tomando `asunto`, `para`, `html` y `texto`.
//
// Entra `inputs.formulario`, el mismo objeto que manda la landing, y el modo de
// construir el enlace de baja (ver abajo).
//
// ## El enlace de baja no es opcional
//
// La política publicada promete, literalmente, que se puede retirar el
// consentimiento «con el enlace de baja de cada correo». Y este correo es
// marketing: dice que a partir de ahora se enviarán experiencias, encuentros y
// novedades. Sin enlace, esa frase de la política es falsa desde el primer
// envío, y el art. 21.3 del RGPD pide ofrecer la oposición de forma explícita
// en cada comunicación.
//
// Por eso, si no hay forma de armar el enlace, esto NO devuelve el correo: para
// el flujo con un motivo visible en vez de mandar algo que incumple. Se puede
// desactivar con `inputs.permitirSinBaja`, pero hay que quererlo.

// Mailjet no escapa nada: el nombre entra tal cual en el HTML. Viene de un
// campo abierto de un formulario público, así que un apellido con "&" ya rompe
// el marcado, y algo peor puede inyectar etiquetas.
const escapar = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ASUNTO = 'Bienvenida a El Arte de Reinventarte 🤍';
const INSTAGRAM = 'https://www.instagram.com/elartereinventarte/';
const SITIO = 'https://elartereinventarte.com';
const CONTACTO = 'info@elartereinventarte.com';

// La baja vive en la instancia del cliente, no en la landing: es ahí donde está
// la ficha que hay que marcar.
const INSTANCIA = 'https://el-arte-de-reinventarte.perfectflow.cloud';
// El idioma en el que lee esta comunidad. La página de baja se sirve por locale.
const IDIOMA = 'es';

// El token es por contacto y opaco. No vale el id ni el correo: con el correo
// en la URL, cualquiera da de baja a cualquiera probando direcciones, y con el
// id basta con contar. Lo emite PerfectFlow y viaja en la ficha.
const urlDeBaja = ({ urlBaja, tokenBaja }) => {
  if (urlBaja) return String(urlBaja);            // ya viene armada: manda
  if (!tokenBaja) return '';
  // El `/es` no es decorativo: la ruta vive dentro de `scope '/:locale'`
  // (`config/routes.rb:86`), así que sin prefijo de idioma da 404.
  return `${INSTANCIA}/${IDIOMA}/baja/${encodeURIComponent(String(tokenBaja))}`;
};

// Los párrafos, en un solo sitio: la versión en texto plano se arma con los
// mismos, así que no pueden quedar descompasadas sin que se note.
const PARRAFOS = [
  'Creamos este espacio para mujeres que están atravesando cambios, nuevos comienzos o simplemente sienten que quieren vivir su próxima etapa con más claridad y dirección.',
  'A partir de ahora, te compartiremos por aquí nuestras próximas experiencias, encuentros, herramientas, conversaciones y novedades de la comunidad.',
];

const html = ({ saludo, baja }) => `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Bienvenida a El Arte de Reinventarte</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>
  .serif, .serif * { font-family: Georgia, serif !important; }
  .sans,  .sans  * { font-family: 'Segoe UI', Arial, sans-serif !important; }
</style>
<![endif]-->
<style>
  @media only screen and (max-width:620px) {
    .caja    { width:100% !important; }
    .respira { padding-left:26px !important; padding-right:26px !important; }
    .titulo  { font-size:30px !important; line-height:1.2 !important; }
    .boton a { display:block !important; }
  }
  a { text-decoration:none; }
  .cuerpo a { color:#E5CB94 !important; }
</style>
</head>
<body style="margin:0; padding:0; background-color:#120E09; -webkit-font-smoothing:antialiased;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all; font-size:1px; line-height:1px; color:#120E09;">
  Ya eres parte de la comunidad. Te contamos qué viene ahora.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#120E09;">
  <tr><td align="center" style="padding:32px 12px 48px 12px;">

    <table role="presentation" class="caja" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#1B1610; border:1px solid #2F2921;">
      <tr>
        <td class="respira sans" align="center" style="padding:40px 40px 4px 40px; font-family:'Segoe UI',Helvetica,Arial,sans-serif; font-size:12px; font-weight:600; letter-spacing:3px; text-transform:uppercase; color:#C79A4E;">
          El Arte de Reinventarte
        </td>
      </tr>
      <tr>
        <td class="respira" style="padding:44px 48px 0 48px;">
          <p class="serif cuerpo" style="margin:0 0 26px 0; font-family:Georgia,'Times New Roman',serif; font-size:18px; line-height:1.65; color:#F2ECE1;">${saludo}</p>
          <h1 class="serif titulo" style="margin:0 0 30px 0; font-family:Georgia,'Times New Roman',serif; font-size:34px; line-height:1.22; font-weight:normal; color:#F2ECE1;">
            Ya eres parte de la comunidad de El&nbsp;Arte de&nbsp;Reinventarte.
          </h1>
        </td>
      </tr>
      <tr>
        <td class="respira" style="padding:0 48px 8px 48px;">
          ${PARRAFOS.map((t) => `<p class="serif cuerpo" style="margin:0 0 22px 0; font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:1.72; color:#D8CFC2;">${t}</p>`).join('\n          ')}
          <p class="serif cuerpo" style="margin:0 0 22px 0; font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:1.72; color:#D8CFC2;">
            Mientras tanto, puedes seguir acompañándonos en
            <a href="${INSTAGRAM}" style="color:#E5CB94; text-decoration:none; border-bottom:1px solid #8A6F3E;">@elartereinventarte</a>
            y conocer todo lo que estamos construyendo para ti.
          </p>
        </td>
      </tr>
      <tr>
        <td class="respira" align="center" style="padding:20px 48px 8px 48px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="boton">
            <tr>
              <td align="center" bgcolor="#C79A4E" style="background-color:#C79A4E;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${INSTAGRAM}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="0%" stroke="f" fillcolor="#C79A4E">
                  <w:anchorlock/>
                  <center style="color:#160F06;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:2px;">SEGUIRNOS EN INSTAGRAM</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-- -->
                <a class="sans" href="${INSTAGRAM}" style="display:inline-block; padding:16px 34px; font-family:'Segoe UI',Helvetica,Arial,sans-serif; font-size:13px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:#160F06; text-decoration:none;">Seguirnos en Instagram</a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="respira" style="padding:34px 48px 44px 48px;">
          <p class="serif" style="margin:0 0 6px 0; font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:1.72; font-style:italic; color:#E5CB94;">Bienvenida. Nos alegra que estés aquí. 🤍</p>
          <p class="sans" style="margin:22px 0 0 0; font-family:'Segoe UI',Helvetica,Arial,sans-serif; font-size:12px; letter-spacing:2px; text-transform:uppercase; color:#B2A28C;">Equipo El Arte de Reinventarte</p>
        </td>
      </tr>
    </table>

    <table role="presentation" class="caja" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
      <tr>
        <td class="respira sans" align="center" style="padding:26px 48px 0 48px; font-family:'Segoe UI',Helvetica,Arial,sans-serif; font-size:12px; line-height:1.8; color:#7E7263;">
          <a href="${SITIO}" style="color:#9C8F7D; text-decoration:none;">elartereinventarte.com</a>
          &nbsp;·&nbsp;
          <a href="mailto:${CONTACTO}" style="color:#9C8F7D; text-decoration:none;">${CONTACTO}</a>
          <br>
          Recibes este correo porque te apuntaste a la Comunidad de interés en nuestra web.${baja ? `
          <br>
          <a href="${baja}" style="color:#9C8F7D; text-decoration:underline;">Darme de baja</a>` : ''}
        </td>
      </tr>
    </table>

  </td></tr>
</table>
</body>
</html>`;

// Un correo que sólo lleva HTML es de las señales que más pesa en los filtros
// de spam, y es lo único que ve quien lee en modo texto.
const texto = ({ saludo, baja }) => [
  saludo, '',
  'Ya eres parte de la comunidad de El Arte de Reinventarte.', '',
  ...PARRAFOS.flatMap((t) => [t, '']),
  'Mientras tanto, puedes seguir acompañándonos en @elartereinventarte:',
  INSTAGRAM, '',
  'Bienvenida. Nos alegra que estés aquí.', '',
  'Equipo El Arte de Reinventarte',
  SITIO, '',
  '—',
  'Recibes este correo porque te apuntaste a la Comunidad de interés en nuestra web.',
  ...(baja ? ['Darte de baja: ' + baja] : []),
].join('\n');

export const code = async (inputs) => {
  const form = inputs.formulario || {};
  const baja = urlDeBaja(inputs);

  const nombre = (form.nombre || '').trim();
  const para = (form.email || '').trim();

  // Se apuntó sólo con WhatsApp: no hay correo que armar. Se devuelve el motivo
  // en vez de lanzar, para que se vea en el historial del flujo.
  if (!para) return { listo: false, motivo: 'el formulario no trae correo' };

  // Sin enlace de baja no sale. Ver la nota de arriba: es lo que promete la
  // política, y mandar sin él la desmiente.
  if (!baja && !inputs.permitirSinBaja) {
    return {
      listo: false,
      motivo: 'falta el enlace de baja: se esperaba inputs.tokenBaja (o inputs.urlBaja ya armada)',
    };
  }

  // El saludo se decide entero, no por sustitución: sin nombre queda "Hola." y
  // no "Hola, ." ni "Hola, Hola.".
  const saludo = nombre ? `Hola, ${escapar(nombre)}.` : 'Hola.';
  const saludoTexto = nombre ? `Hola, ${nombre}.` : 'Hola.';

  return {
    listo: true,
    para,
    nombre,
    asunto: ASUNTO,
    html: html({ saludo, baja }),
    texto: texto({ saludo: saludoTexto, baja }),
    // Para que el step de envío las ponga como cabeceras. `List-Unsubscribe`
    // es lo que convierte el "esto es spam" de Gmail en una baja limpia, y la
    // segunda habilita el botón de un clic (RFC 8058) — que exige POST, por eso
    // el enlace del pie y esta cabecera apuntan al mismo sitio pero no se usan
    // igual.
    listUnsubscribe: baja ? `<${baja}>, <mailto:${CONTACTO}?subject=Baja>` : '',
    listUnsubscribePost: baja ? 'List-Unsubscribe=One-Click' : '',
  };
};
