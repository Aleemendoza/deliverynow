"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const MINIMUM_ADDRESS_LENGTH = 5;

export function QuickEstimator() {
  const router = useRouter();
  const [pickup, setPickup] = useState("");
  const [delivery, setDelivery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const pickupIsValid = pickup.trim().length >= MINIMUM_ADDRESS_LENGTH;
  const deliveryIsValid = delivery.trim().length >= MINIMUM_ADDRESS_LENGTH;
  const canContinue = pickupIsValid && deliveryIsValid;

  const continueToOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (canContinue) router.push("/solicitar");
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
      <h2 className="mb-4 text-lg font-bold">Calculá tu envío</h2>
      <form autoComplete="off" className="grid gap-3 md:grid-cols-3" noValidate onSubmit={continueToOrder}>
        <div>
          <input
            autoComplete="off"
            aria-describedby={submitted && !pickupIsValid ? "pickup-error" : undefined}
            aria-invalid={submitted && !pickupIsValid}
            aria-label="Dirección de retiro"
            onChange={(event) => setPickup(event.target.value)}
            placeholder="¿Dónde retiramos?"
            value={pickup}
            className="w-full rounded-lg bg-zinc-800 px-4 py-3 outline-none ring-yellow-400 focus:ring-2"
          />
          {submitted && !pickupIsValid && <p id="pickup-error" className="mt-1 text-xs text-red-400">Ingresá la dirección de retiro.</p>}
        </div>
        <div>
          <input
            autoComplete="off"
            aria-describedby={submitted && !deliveryIsValid ? "delivery-error" : undefined}
            aria-invalid={submitted && !deliveryIsValid}
            aria-label="Dirección de entrega"
            onChange={(event) => setDelivery(event.target.value)}
            placeholder="¿Dónde entregamos?"
            value={delivery}
            className="w-full rounded-lg bg-zinc-800 px-4 py-3 outline-none ring-yellow-400 focus:ring-2"
          />
          {submitted && !deliveryIsValid && <p id="delivery-error" className="mt-1 text-xs text-red-400">Ingresá la dirección de entrega.</p>}
        </div>
        <button
          className="rounded-lg bg-yellow-400 px-4 py-3 text-center font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canContinue}
          type="submit"
        >
          Continuar
        </button>
      </form>
      {!canContinue && <p className="mt-3 text-xs text-zinc-400">Completá las direcciones de retiro y entrega para continuar.</p>}
      <p className="mt-1 text-xs text-zinc-400">El precio final se calcula con una ruta verificada antes de confirmar.</p>
    </section>
  );
}
