import { SiteHeader } from "@/components/site-header";

const questions = [
  ["¿Cómo sé cuánto voy a pagar?", "Calculamos la ruta real y te mostramos el total antes de que confirmes."],
  ["¿Puedo seguir el pedido?", "Sí. Recibís un código y podés ver el estado sin crear una cuenta."],
  ["¿Cómo se finaliza la entrega?", "El cadete actualiza el estado operativo al completar el recorrido."],
];

export default function FAQ() {
  return <><SiteHeader/><main className="mx-auto max-w-2xl px-4 py-14"><p className="font-bold text-yellow-400">AYUDA</p><h1 className="mt-2 text-4xl font-black">Preguntas frecuentes</h1><div className="mt-7 space-y-3">{questions.map(([question, answer]) => <article className="rounded-xl bg-zinc-900 p-5" key={question}><h2 className="font-bold">{question}</h2><p className="mt-2 text-zinc-400">{answer}</p></article>)}</div></main></>;
}
