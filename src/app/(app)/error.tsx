'use client'

import React from 'react'

/**
 * Chybová hranica storefrontu — nahrádza template-ovú anglickú „Oh no!"
 * obrazovku brandovanou slovenskou verziou. Najčastejšie sa ukáže pri
 * prechodnom zlyhaní počas nasadzovania novej verzie; „Skúsiť znova"
 * spravidla stačí.
 */
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-brand-50 px-6 py-16">
      <div className="w-full max-w-xl rounded-default border border-gray-200 bg-white p-8 text-center md:p-12">
        <p className="font-tech text-xs font-bold uppercase tracking-widest text-brand">
          Ups, niečo sa zamotalo
        </p>
        <h2 className="mt-3 font-display text-2xl font-medium text-black md:text-3xl">
          Stránku sa nepodarilo načítať
        </h2>
        <p className="mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed text-gray-600">
          Pravdepodobne ide o dočasný výpadok — napríklad počas nasadzovania novej verzie webu.
          Skúste to o chvíľu znova.
        </p>
        <button
          className="mt-8 inline-flex w-full items-center justify-center rounded-default bg-brand px-6 py-3.5 font-tech text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-dark sm:w-auto"
          onClick={() => reset()}
          type="button"
        >
          Skúsiť znova
        </button>
      </div>
    </div>
  )
}
