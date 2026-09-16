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

const INSTANCIA = 'https://el-arte-de-reinventarte.perfectflow.cloud';

// El slug sale de CustomModel#api_slug, que pluraliza en español: contacto ->
// contactos. Si alguien renombra el modelo en el CRM, esto deja de resolver y la
// llamada devuelve 404 — que es ruidoso, y está bien que lo sea.
const RECURSO = 'contactos';

// El estado inicial del embudo, tal cual está en el seed (`egda_elena.rb`).
// Se manda explícito en vez de confiar en el inicial por defecto: si mañana
// alguien reordena los estados, el lead no se va en silencio a otro sitio.
const ESTADO = 'nuevo';

const texto = (v) => (v == null ? '' : String(v).trim());

// Lo que la landing llama `utm_source` es el `origen` de la ficha, y `utm_campaign`
// la `campana`. Se traduce acá y no en el CRM porque el nombre de la columna es
// del negocio, no de la herramienta que trajo el dato.
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
    origen: texto(form.utm_source) || 'directo',
    campana: texto(form.utm_campaign),
    // La prueba del consentimiento: qué aceptó, cuándo y por dónde. Los tres
    // juntos o ninguno sirve — «dijo que sí» sin fecha no demuestra nada.
    consentimiento: consintio,
    consentimiento_fecha: texto(form.fecha_registro) || new Date().toISOString().slice(0, 10),
    consentimiento_via: 'formulario web',
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

  const url = `${INSTANCIA}/api/v1/automation/${RECURSO}?state=${encodeURIComponent(ESTADO)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Basic con el token de la Station como contraseña. El usuario se ignora
      // del lado de Rails: lo que autentica es el token.
      Authorization: 'Basic ' + Buffer.from(`perfectflow:${tokenStation}`).toString('base64'),
      // Que un reintento del flujo no cree dos fichas de la misma persona.
      'Idempotency-Key': `bienvenida:${email || whatsapp}`,
    },
    body: JSON.stringify(cuerpo),
  });

  const ficha = await res.json().catch(() => ({}));

  // 201 es alta; 200 es que ya existía y la deduplicación lo devolvió
  // enriquecido. Los dos son éxito: para el flujo es idempotente, que es lo que
  // se quiere de un webhook.
  if (!res.ok) {
    return { creado: false, motivo: `PerfectFlow respondió ${res.status}`, respuesta: ficha };
  }

  return {
    creado: true,
    nuevo: res.status === 201,
    id: ficha.id,
    estado: ficha.state_code,
    ficha,
    // Lo que el siguiente step necesita para armar el correo.
    // `tokenBaja` todavía no lo emite PerfectFlow — es el ticket PF-10 — así que
    // hoy llega vacío y `enviar-bienvenida.js` para el flujo a propósito.
    tokenBaja: ficha.baja_token || '',
  };
};
