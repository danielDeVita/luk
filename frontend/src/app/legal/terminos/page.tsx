import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_JURISDICTION_CITY,
  LEGAL_LAST_UPDATED,
  LEGAL_OPERATOR_NAME,
  LEGAL_TERMS_VERSION,
  PLATFORM_COMMISSION_PERCENT,
} from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description:
    'Leé los términos y condiciones de uso de LUK, incluyendo reglas de participación, obligaciones de vendedores y tratamiento de promociones sociales.',
  alternates: {
    canonical: '/legal/terminos',
  },
  openGraph: {
    title: `Términos y condiciones | ${BRAND_NAME}`,
    description:
      'Condiciones de uso de LUK para registro, compra de tickets, publicación de rifas y programa de promoción social.',
    type: 'article',
    url: '/legal/terminos',
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary',
    title: `Términos y condiciones | ${BRAND_NAME}`,
    description:
      'Condiciones de uso de LUK para registro, compra de tickets, publicación de rifas y programa de promoción social.',
  },
};

export default function TerminosPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </Button>
        </Link>
      </div>

      <article className="prose prose-slate dark:prose-invert max-w-none">
        <h1 className="text-3xl font-bold mb-2">Términos y Condiciones de Uso de la Plataforma</h1>
        <p className="text-muted-foreground mb-8">Última actualización: {LEGAL_LAST_UPDATED}</p>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-8">
          <p className="text-sm text-amber-800 dark:text-amber-200 m-0">
            <strong>Importante:</strong> Al utilizar esta plataforma, usted declara ser mayor de 18 años y acepta estos términos en su totalidad.
          </p>
        </div>

        <p>
          Estos Términos y Condiciones de Uso (en adelante, los &quot;Términos&quot;) constituyen un acuerdo legal vinculante entre usted (el &quot;Usuario&quot;, &quot;Comprador&quot;, &quot;Vendedor&quot; u &quot;Organizador de Rifas&quot;, según corresponda) y <strong>{LEGAL_OPERATOR_NAME}</strong>, operador de la plataforma y responsable de su explotacion comercial en la Republica Argentina (en adelante, la &quot;Empresa&quot; o &quot;nosotros&quot;).
        </p>

        <p>
          Al acceder, registrarse o utilizar la plataforma web y/o aplicación móvil (en adelante, la &quot;Plataforma&quot;), que facilita la compra y venta de boletos para rifas y sorteos con pagos integrados, usted declara haber leído, comprendido y aceptado estos Términos en su totalidad, así como nuestra Política de Privacidad, que forma parte integral de estos Términos.
        </p>

        <p>
          Si no está de acuerdo con estos Términos, no debe acceder ni utilizar la Plataforma. La Empresa se reserva el derecho de modificar estos Términos en cualquier momento, notificando a los Usuarios mediante publicación en la Plataforma o por correo electrónico. El uso continuado de la Plataforma después de cualquier modificación implica la aceptación de los cambios. Recomendamos revisar periódicamente estos Términos.
        </p>

        <h2>1. Descripción de la Plataforma</h2>

        <p>La Plataforma es un marketplace digital que permite a los Usuarios:</p>

        <ul>
          <li><strong>Como Organizadores o Vendedores:</strong> Crear, promocionar y vender boletos para rifas o sorteos (en adelante, &quot;Rifas&quot;), sujetas a las regulaciones aplicables.</li>
          <li><strong>Como Compradores:</strong> Adquirir boletos para participar en Rifas organizadas por terceros a través de la Plataforma.</li>
          <li>Facilitar pagos seguros por los boletos, con sorteos posteriores gestionados por los Organizadores.</li>
        </ul>

        <p>
          La Plataforma actúa únicamente como intermediaria tecnológica y no organiza, administra ni realiza los sorteos. No garantizamos la validez, legalidad o resultado de ninguna Rifa. Todas las transacciones se rigen por las leyes argentinas aplicables, incluyendo pero no limitadas a la regulación provincial de juegos de azar, la Ley de Defensa del Consumidor N° 24.240 (modificada por Ley N° 26.361 y Decreto 961/2017), y la Ley de Protección de los Datos Personales N° 25.326.
        </p>

        <p>
          De conformidad con la jurisprudencia de la Corte Suprema de Justicia de la Nación (Fallos 322:1142), los juegos de azar, incluyendo rifas, no son materia federal exclusiva, por lo que cada provincia regula su explotación y fiscalización. La Plataforma no asume responsabilidad por el cumplimiento de normativas provinciales específicas por parte de los Usuarios.
        </p>

        <h2>2. Requisitos de Elegibilidad y Registro</h2>

        <p>Para utilizar la Plataforma, el Usuario debe:</p>

        <ul>
          <li>
            <strong>Ser mayor de 18 años de edad</strong>, ya que la participación en juegos de azar está prohibida para menores según la legislación argentina (por ejemplo, Ley N° 18.226, Art. 20 de la Resolución N° 259/98 de Lotería Nacional S.E., y normativas provinciales como la Ley N° 538/2000 de la Ciudad de Buenos Aires). Al registrarse, el Usuario declara bajo juramento ser mayor de edad y acepta que la Empresa pueda requerir verificación de identidad (por ejemplo, mediante DNI o pasaporte).
          </li>
          <li>
            <strong>Tener residencia legal</strong> en la República Argentina o en jurisdicciones donde la Plataforma esté disponible, sujetas a restricciones provinciales (por ejemplo, en Santa Fe, las apuestas online se limitan a residentes provinciales según Ley N° 14.235 de 2025).
          </li>
          <li>
            <strong>No estar inhabilitado legalmente</strong> para participar en juegos de azar (por ejemplo, por ludopatía registrada o prohibiciones judiciales).
          </li>
          <li>
            <strong>Proporcionar información veraz y completa</strong> durante el registro, incluyendo: nombre completo, DNI/CUIT, fecha de nacimiento, dirección de correo electrónico, número de teléfono, domicilio real y, si aplica, datos bancarios para pagos. La Empresa puede requerir verificación adicional (KYC - Know Your Customer) para prevenir fraudes, lavado de activos o financiamiento del terrorismo, conforme a la Ley N° 25.246 (UIF) y Resolución General ARCA N° 5791/2025.
          </li>
          <li>
            <strong>Crear una cuenta única y no transferible</strong>, protegiendo sus credenciales de acceso. El Usuario es responsable de toda actividad en su cuenta.
          </li>
        </ul>

        <p>La Empresa se reserva el derecho de rechazar o suspender cuentas que no cumplan con estos requisitos, sin responsabilidad alguna.</p>

        <h2>3. Obligaciones de los Usuarios</h2>

        <h3>3.1 Obligaciones Generales</h3>

        <ul>
          <li>Cumplir con todas las leyes aplicables, incluyendo regulaciones provinciales sobre rifas (por ejemplo, Decreto N° 793/09 en Tierra del Fuego para rifas benéficas, o requisitos del IPRA/ISS para autorización previa).</li>
          <li>No utilizar la Plataforma para actividades ilegales, fraudulentas o que violen derechos de terceros.</li>
          <li>Proporcionar información precisa sobre las Rifas, incluyendo descripción detallada de premios, fechas de sorteo, método de extracción (manual o por quiniela oficial), y destino de fondos si es benéfica.</li>
          <li>Abstenerse de publicidad engañosa, conforme a la Ley de Lealtad Comercial N° 22.802 y Decreto 274/2019, que prohíbe promociones condicionadas a compras si intervienen el azar.</li>
          <li>Cumplir con restricciones publicitarias recientes, como la Resolución 446/2025, que exige advertencias obligatorias en publicidad de juegos de azar y prohíbe el uso de influencers sin autorización.</li>
        </ul>

        <h3>3.2 Obligaciones Específicas de Organizadores/Vendedores</h3>

        <ul>
          <li>Obtener todas las autorizaciones requeridas para la Rifa (por ejemplo, de Lotería Nacional S.E. si es en CABA con premios mayores a $6.000 y difusión masiva, o provinciales como DAFAS-ISS en La Pampa). La Plataforma no verifica ni garantiza dichas autorizaciones; el Organizador es exclusivamente responsable.</li>
          <li>Asegurar que los premios representen al menos el 25% del valor total de boletos emitidos (por ejemplo, según Decreto 793/09).</li>
          <li>Pagar cánones o tasas aplicables (por ejemplo, 10% de la emisión en algunas provincias).</li>
          <li>Notificar resultados de sorteos de manera transparente y entregar premios en un plazo razonable (máximo 6 meses según Ley N° 302/1987 en Tierra del Fuego).</li>
          <li>Prohibir participación de menores y verificar edad si es necesario.</li>
        </ul>

        <h3>3.3 Obligaciones de Compradores</h3>

        <ul>
          <li>Verificar la legalidad de la Rifa antes de comprar.</li>
          <li>Aceptar que no hay reembolsos una vez comprado el boleto, salvo por cancelación de la Rifa por el Organizador (sujeto a Ley 24.240, que permite retracto en compras online dentro de 10 días).</li>
          <li>Proporcionar datos precisos para entrega de premios.</li>
        </ul>

        <h2>4. Productos y Actividades Prohibidas</h2>

        <p>Queda estrictamente prohibido en la Plataforma:</p>

        <ul>
          <li><strong>Rifas sin autorización legal</strong> o que compitan con juegos oficiales (por ejemplo, prohibidas por Ley N° 4.097 de 1902, que veda juegos de azar no autorizados).</li>
          <li><strong>Premios prohibidos:</strong> Bienes ilegales (drogas, armas, explosivos), bienes robados, animales en peligro, o que violen derechos de propiedad intelectual. No se autorizan rifas con premios que afecten la dignidad, salud o medio ambiente (Ley N° 538/2000).</li>
          <li><strong>Actividades fraudulentas:</strong> Lavado de dinero, phishing, o uso de la Plataforma para esquemas piramidales.</li>
          <li><strong>Publicidad masiva sin advertencias</strong> (por ejemplo, &quot;El juego compulsivo es perjudicial para la salud&quot; según proyectos como S-1116/2025).</li>
          <li><strong>Rifas condicionadas a compras obligatorias</strong> si intervienen el azar (prohibido por Decreto 274/2019).</li>
        </ul>

        <p>La Empresa monitoreará y podrá suspender o eliminar contenidos violatorios, reportando a autoridades si es necesario (por ejemplo, a la UIF o ARCA).</p>

        <h2>5. Pagos, Comisiones e Impuestos</h2>

        <ul>
          <li>Los pagos se procesan a través de proveedores de pago integrados. La Empresa cobra una comisión base del <strong>{PLATFORM_COMMISSION_PERCENT}%</strong> por transacción, salvo promociones o condiciones particulares informadas al momento de operar.</li>
          <li>Los Usuarios son responsables de impuestos aplicables (por ejemplo, percepción impositiva sobre apuestas online según Resolución General ARCA 5791/2025). Para rifas, tasas como el 5-10% sobre premios (Resolución N° 17/2011 de Lotería Nacional).</li>
          <li>No hay reembolsos por boletos comprados, salvo excepciones legales.</li>
          <li>La Plataforma podrá otorgar <strong>bonificaciones promocionales internas</strong>, no transferibles y no canjeables por dinero, aplicables únicamente a compras futuras dentro de Luk y sujetas a condiciones de elegibilidad, vencimiento y uso en rifas de terceros.</li>
        </ul>

        <h2>5 bis. Programa de Promoción Social</h2>

        <p>
          La Plataforma podrá ofrecer un programa opcional mediante el cual un Organizador publique manualmente una rifa en redes sociales y registre el permalink público de dicha publicación para su validación.
        </p>

        <ul>
          <li>Solo califican publicaciones públicas, persistentes y con URL verificable.</li>
          <li>La publicación debe conservar visible el link o token de seguimiento provisto por Luk durante toda la vigencia de la rifa.</li>
          <li>La Plataforma podrá monitorear automáticamente la accesibilidad pública del post y capturar métricas públicas visibles, así como clicks, registros y compras atribuidas dentro de Luk.</li>
          <li>Si la publicación se elimina, se vuelve privada o deja de ser verificable antes del cierre de la rifa, podrá quedar descalificada y perder cualquier bonificación asociada.</li>
        </ul>

        <h2>6. Protección de Datos Personales</h2>

        <p>
          De acuerdo con la Ley N° 25.326, recolectamos datos para operar la Plataforma (nombre, DNI, etc.). El Usuario consiente su tratamiento para fines de verificación, pagos y marketing (con opción de opt-out). Datos se almacenan de forma segura y no se comparten sin consentimiento, salvo requerimientos legales. Consultá nuestra Política de Privacidad para detalles sobre derechos ARCO (acceso, rectificación, cancelación, oposición).
        </p>

        <h2>7. Limitación de Responsabilidad y Descargos</h2>

        <ul>
          <li>La Plataforma se proporciona &quot;tal cual&quot;, sin garantías. La Empresa no es responsable por pérdidas derivadas de Rifas ilegales, fraudes de terceros o fallos técnicos.</li>
          <li>No garantizamos la legalidad de Rifas; los Usuarios asumen riesgos (por ejemplo, multas por rifas no autorizadas, que pueden llegar a $500.000 por Ley 22.802).</li>
          <li>En caso de ludopatía, recomendamos buscar ayuda (por ejemplo, a través de Aprecod en Santa Fe). Prohibimos promoción que incentive adicción (Resolución 446/2025).</li>
          <li>La responsabilidad máxima de la Empresa se limita al monto de comisiones pagadas en los últimos 12 meses.</li>
        </ul>

        <h2>8. Propiedad Intelectual</h2>

        <p>Todos los derechos sobre la Plataforma pertenecen a la Empresa. Los Usuarios otorgan licencia no exclusiva para usar contenidos subidos (descripciones de Rifas).</p>

        <h2>9. Resolución de Disputas</h2>

        <p>
          Cualquier disputa se resolverá bajo las leyes de la República Argentina, con jurisdicción exclusiva en los tribunales ordinarios de <strong>{LEGAL_JURISDICTION_CITY}</strong>, salvo norma de orden publico en contrario. Antes de litigio, intentaremos mediación conforme a Ley 26.589.
        </p>

        <h2>10. Disposiciones Finales</h2>

        <p>
          Estos Términos son integrales. Si alguna cláusula es inválida, las demás permanecen vigentes. Para consultas: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-primary hover:underline">{LEGAL_CONTACT_EMAIL}</a>.
        </p>

        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6 mt-8">
          <p className="font-medium mb-2">Declaración de Aceptación</p>
          <p className="text-sm text-muted-foreground">
            Al usar la Plataforma, usted confirma su comprensión y acuerdo con estos Términos, reconociendo riesgos legales inherentes a rifas online en Argentina, donde la regulación es provincial y en evolución. Recomendamos consultar un abogado para asesoramiento específico.
          </p>
        </div>

        <hr className="my-8" />

        <h2>Información Requerida para Registro</h2>

        <p>Para cumplir con la normativa legal argentina, recolectamos la siguiente información:</p>

        <h3>Información Mínima Obligatoria (al registro)</h3>

        <ul>
          <li><strong>Nombre completo y apellido</strong> - Esencial para identificación y declaración jurada.</li>
          <li><strong>Número de DNI</strong> (o pasaporte para extranjeros) - Clave para verificación de identidad y edad.</li>
          <li><strong>Fecha de nacimiento</strong> - Indispensable para confirmar mayoría de edad (18 o más años).</li>
          <li><strong>Email</strong> - Para comunicaciones y recuperación de cuenta.</li>
        </ul>

        <h3>Información Adicional (requerida antes de primera compra/venta)</h3>

        <ul>
          <li><strong>Domicilio real</strong> (calle, número, ciudad, provincia, CP) - Requerido para KYC y entrega de premios físicos.</li>
          <li><strong>CUIT/CUIL</strong> (especialmente para organizadores/vendedores) - Para trazabilidad impositiva.</li>
          <li><strong>Foto del DNI</strong> (frente y dorso) - Práctica estándar para verificación documental.</li>
          <li><strong>Teléfono de contacto</strong> - Para coordinación de entregas y verificaciones.</li>
        </ul>

        <h3>Base Legal para Recolección de Datos</h3>

        <ul>
          <li><strong>Verificación de edad mínima</strong> - Ley N° 18.226, Resolución N° 259/98 de Lotería Nacional.</li>
          <li><strong>Prevención de lavado de activos (PLA/FT)</strong> - Ley 25.246 y resoluciones UIF.</li>
          <li><strong>Protección de datos personales</strong> - Ley 25.326.</li>
          <li><strong>Prevención de fraudes y verificación de identidad (KYC)</strong> - Similar al exigido en plataformas de apuestas online reguladas.</li>
          <li><strong>Trazabilidad fiscal</strong> - Resolución General ARCA 5791/2025.</li>
        </ul>

        <p className="text-sm text-muted-foreground mt-8">
          Versión de Términos: {LEGAL_TERMS_VERSION} | Fecha de publicación: {LEGAL_LAST_UPDATED}
        </p>
      </article>
    </div>
  );
}
