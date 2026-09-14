import React from 'react'

/**
 * Short intro above the admin login form (`admin.components.beforeLogin`).
 * Slovak, to match the rest of the branded admin panel.
 */
export const BeforeLogin: React.FC = () => {
  return (
    <div>
      <p>
        <b>Administrácia ZAPLETANE.</b>
        {' Tu sa prihlasujú správcovia obchodu. Zákazníci sa prihlasujú '}
        <a href={`${process.env.PAYLOAD_PUBLIC_SERVER_URL ?? ''}/login`}>priamo na webe</a>
        {', kde nájdu svoj účet a históriu objednávok.'}
      </p>
    </div>
  )
}
