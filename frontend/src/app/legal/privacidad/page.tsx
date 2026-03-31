import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_POSTAL_ADDRESS,
  LEGAL_TERMS_VERSION,
} from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description:
    'Consultá cómo LUK recopila, usa, protege y comparte tus datos personales, incluyendo información de KYC, pagos y promoción social.',
  alternates: {
    canonical: '/legal/privacidad',
  },
  openGraph: {
    title: `Política de privacidad | ${BRAND_NAME}`,
    description:
      'Cómo LUK recopila, usa, protege y comparte datos personales para operar la plataforma de rifas digitales.',
    type: 'article',
    url: '/legal/privacidad',
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary',
    title: `Política de privacidad | ${BRAND_NAME}`,
    description:
      'Cómo LUK recopila, usa, protege y comparte datos personales para operar la plataforma de rifas digitales.',
  },
};

export default function PrivacidadPage() {
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
        <h1 className="text-3xl font-bold mb-2">Política de Privacidad</h1>
        <p className="text-muted-foreground mb-8">Última actualización: {LEGAL_LAST_UPDATED}</p>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <p className="text-sm text-blue-800 dark:text-blue-200 m-0">
            <strong>Tu privacidad es importante para nosotros.</strong> Esta política explica cómo recopilamos, usamos y protegemos tu información personal.
          </p>
        </div>

        <h2>1. Información que Recopilamos</h2>

        <h3>1.1 Información que nos proporcionás</h3>
        <ul>
          <li><strong>Datos de registro:</strong> Nombre, apellido, email, fecha de nacimiento y contraseña.</li>
          <li><strong>Datos de verificación (KYC):</strong> DNI, CUIT/CUIL, domicilio, teléfono y foto de documento.</li>
          <li><strong>Datos de pago:</strong> Información de tu cuenta de Mercado Pago vinculada.</li>
        </ul>

        <h3>1.2 Información que recopilamos automáticamente</h3>
        <ul>
          <li><strong>Datos de uso:</strong> Páginas visitadas, rifas en las que participás, compras realizadas.</li>
          <li><strong>Datos técnicos:</strong> Dirección IP, tipo de navegador, dispositivo y sistema operativo.</li>
          <li><strong>Cookies:</strong> Utilizamos cookies para mejorar tu experiencia. Consultá nuestra sección de cookies.</li>
          <li><strong>Datos de promoción social:</strong> Si participás del programa de promoción social, podemos almacenar el permalink del post público, su estado de accesibilidad, métricas públicas visibles y eventos atribuidos dentro de Luk.</li>
        </ul>

        <h2>2. Cómo Usamos tu Información</h2>

        <p>Utilizamos tu información personal para:</p>

        <ul>
          <li>Crear y administrar tu cuenta en la plataforma.</li>
          <li>Verificar tu identidad y edad (mayor de 18 años) según normativa vigente.</li>
          <li>Procesar tus compras de boletos y pagos.</li>
          <li>Comunicarte sobre tus participaciones, sorteos y premios.</li>
          <li>Cumplir con obligaciones legales (Ley 25.246 - UIF, ARCA, etc.).</li>
          <li>Prevenir fraudes y actividades ilegales.</li>
          <li>Mejorar nuestros servicios y personalizar tu experiencia.</li>
          <li>Validar publicaciones públicas asociadas al programa de promoción social y calcular bonificaciones promocionales internas.</li>
        </ul>

        <h2>3. Base Legal para el Tratamiento</h2>

        <p>Procesamos tu información basándonos en:</p>

        <ul>
          <li><strong>Consentimiento:</strong> Al registrarte, aceptás esta política.</li>
          <li><strong>Ejecución contractual:</strong> Para prestarte nuestros servicios.</li>
          <li><strong>Obligación legal:</strong> Cumplimiento de Ley 25.326 (Protección de Datos), Ley 25.246 (UIF), Resolución ARCA 5791/2025.</li>
          <li><strong>Interés legítimo:</strong> Prevención de fraudes y mejora de servicios.</li>
        </ul>

        <h2>4. Compartición de Datos</h2>

        <p>Podemos compartir tu información con:</p>

        <ul>
          <li><strong>Mercado Pago:</strong> Para procesar pagos de boletos.</li>
          <li><strong>Organizadores de rifas:</strong> Datos necesarios para entrega de premios.</li>
          <li><strong>Autoridades:</strong> Cuando sea requerido por ley (UIF, ARCA, autoridades judiciales).</li>
          <li><strong>Proveedores de servicios:</strong> Hosting, analytics, soporte técnico (bajo estrictos acuerdos de confidencialidad).</li>
        </ul>

        <p><strong>No vendemos ni alquilamos tu información personal a terceros.</strong></p>

        <h2>5. Seguridad de los Datos</h2>

        <p>Implementamos medidas de seguridad técnicas y organizativas para proteger tu información:</p>

        <ul>
          <li>Encriptación de datos en tránsito (HTTPS/TLS) y en reposo.</li>
          <li>Acceso restringido a información personal.</li>
          <li>Monitoreo continuo de actividades sospechosas.</li>
          <li>Copias de seguridad regulares.</li>
        </ul>

        <h2>6. Tus Derechos (Derechos ARCO)</h2>

        <p>De acuerdo con la Ley 25.326, tenés derecho a:</p>

        <ul>
          <li><strong>Acceso:</strong> Solicitar información sobre los datos que tenemos sobre vos.</li>
          <li><strong>Rectificación:</strong> Corregir datos inexactos o incompletos.</li>
          <li><strong>Cancelación:</strong> Solicitar la eliminación de tus datos (sujeto a obligaciones legales de retención).</li>
          <li><strong>Oposición:</strong> Oponerte al tratamiento de tus datos para fines específicos.</li>
        </ul>

        <p>Para ejercer estos derechos, contactanos a: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-primary hover:underline">{LEGAL_CONTACT_EMAIL}</a></p>

        <h2>7. Retención de Datos</h2>

        <p>Conservamos tu información personal:</p>

        <ul>
          <li><strong>Datos de cuenta:</strong> Mientras tu cuenta esté activa.</li>
          <li><strong>Datos de transacciones:</strong> 10 años (obligación fiscal según ARCA).</li>
          <li><strong>Datos de verificación KYC:</strong> 5 años después del cierre de cuenta (Ley 25.246).</li>
        </ul>

        <h2>8. Cookies y Tecnologías Similares</h2>

        <p>Utilizamos cookies para:</p>

        <ul>
          <li><strong>Cookies esenciales:</strong> Necesarias para el funcionamiento del sitio.</li>
          <li><strong>Cookies de rendimiento:</strong> Análisis de uso y mejora de servicios.</li>
          <li><strong>Cookies de funcionalidad:</strong> Recordar tus preferencias.</li>
        </ul>

        <p>Podés gestionar las cookies desde la configuración de tu navegador.</p>

        <h2>9. Menores de Edad</h2>

        <p>
          Nuestra plataforma está dirigida exclusivamente a mayores de 18 años. No recopilamos intencionalmente información de menores. Si detectamos que un menor se ha registrado, eliminaremos su cuenta y datos inmediatamente.
        </p>

        <h2>10. Cambios a esta Política</h2>

        <p>
          Podemos actualizar esta política periódicamente. Te notificaremos cambios significativos por email o mediante aviso en la plataforma. El uso continuado después de los cambios implica aceptación.
        </p>

        <h2>11. Contacto</h2>

        <p>
          Si tenés preguntas sobre esta política o querés ejercer tus derechos, contactanos:
        </p>

        <ul>
          <li><strong>Email:</strong> <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-primary hover:underline">{LEGAL_CONTACT_EMAIL}</a></li>
          <li><strong>Domicilio:</strong> {LEGAL_POSTAL_ADDRESS}</li>
        </ul>

        <p>
          También podés presentar una denuncia ante la Agencia de Acceso a la Información Pública (AAIP): <a href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.argentina.gob.ar/aaip</a>
        </p>

        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6 mt-8">
          <p className="font-medium mb-2">Resumen</p>
          <p className="text-sm text-muted-foreground">
            Recopilamos solo la información necesaria para brindarte nuestros servicios y cumplir con la ley. Protegemos tus datos con medidas de seguridad robustas y nunca los vendemos. Tenés control sobre tu información y podés ejercer tus derechos contactándonos.
          </p>
        </div>

        <p className="text-sm text-muted-foreground mt-8">
          Versión de Política: {LEGAL_TERMS_VERSION} | Fecha de publicación: {LEGAL_LAST_UPDATED}
        </p>
      </article>
    </div>
  );
}
