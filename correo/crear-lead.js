// Crea el lead en PerfectFlow y devuelve la ficha. Va ANTES de armar el correo:
// el contacto tiene que existir primero, y de él sale el token de baja que el
// correo necesita.
//
// Entra `inputs.formulario` — el mismo objeto que manda la landing — y el token
// de la Station en `inputs.tokenStation`.
//
// ## Por qué no basta con mandar el correo
//
// Sin este paso, una persona que se apunta recibe la bienvenida y no existe en
// ninguna parte: no hay a quién dar de baja, no hay consentimiento registrado, y
// la promesa de la política de conservar «la fecha de tu registro, el hecho de
// que diste tu consentimiento y el momento en que lo hiciste, como prueba de que
// el registro fue voluntario» no la cumple nadie.

// Dos formas de llegar, y las dos válidas:
//
//   A. `baseUrl` público — https://el-arte-de-reinventarte.perfectflow.cloud
//      Sale a internet y vuelve.
//
//   B. `baseUrl` interno — http://fs:3000, con `tenantHost` para la cabecera Host.
//      No sale del droplet. Es la buena, y la que documenta nginx_lite.conf.tpl.
//
// La cabecera Host NO es cosmética: en Lite el tenant sale del subdominio, y de
// él salen las dos cosas que importan — qué fichas se ven y con qué token se
// autentica. Sin ella, Rails rechaza (`require_tenant_in_lite!`), y hace bien:
// sin tenant la consulta alcanzaría a todas las Stations del droplet.
const PUBLICA = 'https://el-arte-de-reinventarte.perfectflow.cloud';
const HOST_TENANT = 'el-arte-de-reinventarte.perfectflow.cloud';

// El slug sale de CustomModel#api_slug, que pluraliza en español: contacto ->
// contactos. Si alguien renombra el modelo en el CRM, esto deja de resolver y la
// llamada devuelve 404 — que es ruidoso, y está bien que lo sea.
const RECURSO = 'contactos';

// El estado inicial del embudo, tal cual está en el seed (`egda_elena.rb`).
// Se manda explícito en vez de confiar en el inicial por defecto: si mañana
// alguien reordena los estados, el lead no se va en silencio a otro sitio.
const ESTADO = 'nuevo';

const texto = (v) => (v == null ? '' : String(v).trim());

// `origen` y `consentimiento_via` son listas cerradas en el CRM: mandar texto
// libre devuelve 422. Y `origen` NO es el utm_source — el seed lo dice: «origen
// dice por dónde llegó al negocio», no qué campaña lo trajo. Quien entra por el
// formulario de la comunidad llegó por ahí, venga del anuncio que venga.
//
// Las opciones salen de ORIGENES y VIAS_CONSENTIMIENTO en `db/seeds/egda_elena.rb`.
// Si alguien las edita en el CRM, esto devuelve 422 con el campo que sobra — que
// es ruidoso, y es mejor que escribir un valor que nadie filtra después.
const ORIGEN = 'Web · Comunidad';
const VIA_CONSENTIMIENTO = 'Formulario web';

// La atribución cruda no cabe en un select, y no debe: va al texto libre, que es
// donde se puede leer entera sin restringir nada.
const atribucion = (form) => {
  const lineas = [
    ['Fuente', form.utm_source], ['Medio', form.utm_medium],
    ['Campaña', form.utm_campaign], ['Contenido', form.utm_content],
    ['Término', form.utm_term], ['Entró por', form.url_entrada],
    ['Vino de', form.referrer], ['Se registró', form.fecha_registro],
  ].filter(([, v]) => texto(v));
  return lineas.map(([k, v]) => `${k}: ${texto(v)}`).join('\n');
};
const fichaDesde = (form) => {
  const consintio = form.consentimiento === true
    || form.consentimiento === 'true'
    || form.consentimiento === 'on'
    || form.consentimiento === 1;

  const campos = {
    nombre: texto(form.nombre),
    apellido: texto(form.apellido),
    whatsapp: texto(form.whatsapp),
    pais: texto(form.pais),
    ciudad: texto(form.ciudad),
    edad: texto(form.edad),
    origen: ORIGEN,
    campana: texto(form.utm_campaign),
    instagram: texto(form.instagram),
    notas: atribucion(form),
    // La prueba del consentimiento: qué aceptó, cuándo y por dónde. Los tres
    // juntos o ninguno sirve — «dijo que sí» sin fecha no demuestra nada.
    consentimiento: consintio,
    consentimiento_fecha: texto(form.fecha_registro) || new Date().toISOString().slice(0, 10),
    consentimiento_via: VIA_CONSENTIMIENTO,
    consentimiento_texto: texto(form.consentimiento_texto),
  };

  // Los vacíos no se mandan: un string vacío pisa el campo, y con la
  // deduplicación en modo merge eso borraría lo que ya había de esa persona.
  return Object.fromEntries(
    Object.entries(campos).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  );
};

export const code = async (inputs) => {
  const form = inputs.formulario || {};
  const tokenStation = texto(inputs.tokenStation);
  // `texto` recorta: un baseUrl con un espacio delante —fácil de colar al
  // copiarlo— rompería la URL sin decir por qué.
  // Un nombre de servicio de docker no tiene puntos —`fs`, no `fs.algo`— y no
  // tiene TLS: el certificado lo termina nginx por fuera. Pedirle https devuelve
  // ERR_SSL_PACKET_LENGTH_TOO_LONG, que no dice nada de lo que pasa. Se corrige
  // acá en vez de explicarlo en un README que nadie lee cuando falla.
  const base = (texto(inputs.baseUrl) || PUBLICA)
    .replace(/\/+$/, '')
    .replace(/^https:\/\/([^./:]+)(:\d+)?$/, 'http://$1$2');
  const host = texto(inputs.tenantHost) || HOST_TENANT;

  const email = texto(form.email);
  const whatsapp = texto(form.whatsapp);

  // Sin correo ni WhatsApp no hay a quién identificar, y la deduplicación no
  // tiene por dónde agarrar: entraría una ficha nueva en cada envío.
  if (!email && !whatsapp) {
    return { creado: false, motivo: 'el formulario no trae ni correo ni WhatsApp' };
  }

  if (!tokenStation) {
    return { creado: false, motivo: 'falta inputs.tokenStation (stations.automation_token)' };
  }

  const nombreCompleto = [texto(form.nombre), texto(form.apellido)].filter(Boolean).join(' ');

  const cuerpo = {
    record: {
      full_name: nombreCompleto || email || whatsapp,
      email,
      phone: whatsapp,
      custom_fields: fichaDesde(form),
    },
  };

  const url = `${base}/api/v1/automation/${RECURSO}?state=${encodeURIComponent(ESTADO)}`;

  // `fetch` lanza cuando la conexión falla —DNS, puerto cerrado, TLS contra un
  // puerto en claro— y esa excepción sale como un stack de OpenSSL que no dice
  // ni a qué URL iba. Envuelta, el flujo devuelve la URL que se intentó, que es
  // lo primero que uno quiere ver.
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Siempre, también en la pública: ahí es redundante y no molesta, y acá
        // es lo único que le dice a Rails de qué Station hablamos.
        // `Host` es una "forbidden header" del estandar fetch: se pone y Node la
        // descarta, reemplazandola por el host de la URL. Comprobado. Por eso la
        // Station se manda en `X-Forwarded-Host`, que si pasa y que Rails respeta
        // para resolver el host de la peticion.
        //
        // Sin ella, Rails recibe `Host: fs:3000` — sin subdominio, sin Station,
        // sin tenant — y `require_tenant_in_lite!` responde 401. Que es correcto:
        // sin tenant la consulta alcanzaria a todas las Stations del droplet.
        'X-Forwarded-Host': host,
        // Los clientes corren RAILS_ENV=demo, y ahi `config.force_ssl = true`
        // (`config/environments/demo.rb:61`). Entrando por http://fs:3000 Rails
        // responde 301 a https://fs:3000 y fetch la sigue: TLS contra un puerto
        // en claro, y el error habla de OpenSSL sin mencionar la redireccion.
        // Esta cabecera es la que pone nginx al trafico de fuera; por dentro hay
        // que ponerla a mano, y con ella Rails no redirige.
        'X-Forwarded-Proto': 'https',
        // Basic con el token de la Station como contraseña. El usuario se ignora
        // del lado de Rails: lo que autentica es el token.
        Authorization: 'Basic ' + Buffer.from(`perfectflow:${tokenStation}`).toString('base64'),
        // Que un REINTENTO no cree dos fichas — no que dos envíos distintos de
        // la misma persona compartan destino.
        //
        // La clave era sólo el correo, y eso los ataba durante las 24 horas que
        // dura la caché del servidor: el 17 de septiembre un alta respondió 201,
        // la ficha desapareció después, y cada intento posterior con ese correo
        // recibía el mismo 201 sin llegar a la base. El flujo daba el alta por
        // buena y mandaba la bienvenida a una ficha que no existía.
        //
        // Con la corrida delante, un reintento sigue deduplicando —que es para
        // lo que existe— y un envío nuevo entra.
        'Idempotency-Key': `bienvenida:${texto(inputs.runId) || texto(form.fecha_registro) || Date.now()}:${email || whatsapp}`,
      },
      body: JSON.stringify(cuerpo),
    });
  } catch (e) {
    return {
      creado: false,
      motivo: `no se pudo conectar con PerfectFlow: ${e?.cause?.code || e?.message || e}`,
      urlIntentada: url,
      hostEnviado: host,
      pista: /SSL|TLS/i.test(String(e?.cause?.code || e))
        ? 'parece HTTPS contra un puerto en claro: el baseUrl debería ser http:// en la red interna'
        : undefined,
    };
  }

  const ficha = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { creado: false, motivo: `PerfectFlow respondió ${res.status}`, respuesta: ficha };
  }

  // 201 es alta. 200 es que la deduplicación encontró a alguien y devolvió ESA
  // ficha en vez de crear la nuestra — y ahí hay que mirar a quién devolvió.
  //
  // `Deduplicable::IDENTITY_SOURCES` compara correo, teléfono e Instagram, y le
  // basta que coincida UNO. Dos personas que comparten teléfono —una pareja, una
  // oficina, un número de relleno mal tecleado— son la misma para esa regla. En
  // modo merge no falla: devuelve 200 con la persona equivocada, y el flujo
  // sigue como si nada.
  //
  // El síntoma es silencioso y caro: el lead nuevo nunca entra, su
  // consentimiento no queda registrado, y si el correo se personaliza con lo que
  // devuelve esta llamada, una persona recibe el nombre y los datos de otra.
  //
  // Por eso: si vuelve una ficha con OTRO correo que el que mandamos, no es
  // nuestra persona. Se para.
  const correoDevuelto = texto(ficha.email).toLowerCase();
  const esOtraPersona = res.status === 200
    && email && correoDevuelto && correoDevuelto !== email.toLowerCase();

  if (esOtraPersona) {
    return {
      creado: false,
      motivo: 'la deduplicación devolvió otro contacto: coincide el teléfono o el usuario de '
        + 'Instagram pero el correo es distinto. El lead NO se creó y no se debe enviar el correo.',
      enviado: email,
      devuelto: correoDevuelto,
      idDevuelto: ficha.id,
    };
  }

  return {
    creado: true,
    nuevo: res.status === 201,
    id: ficha.id,
    estado: ficha.state_code,
    // NO se devuelve la ficha completa a propósito. Lleva notas, historial de
    // atribución y el volcado de `attributes`; el correo sólo necesita el nombre.
    // Si un día hace falta más, que se añada campo a campo.
    nombre: texto(ficha.full_name),
    // A qué instancia y a qué Station fue.
    //
    // El `id` de arriba es de UNA base concreta, no un identificador global:
    // comparar el de una corrida con lo que hay en otra máquina no dice nada, y
    // fue lo que mandó a buscar una ficha al droplet equivocado durante una hora.
    instancia: `${base} · ${host}`,
    // Lo que el siguiente step necesita para armar el correo.
    // `tokenBaja` todavía no lo emite PerfectFlow — es el ticket PF-10 — así que
    // hoy llega vacío y `enviar-bienvenida.js` para el flujo a propósito.
    tokenBaja: ficha.baja_token || '',
  };
};
