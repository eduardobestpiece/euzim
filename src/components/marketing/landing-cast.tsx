import Image from "next/image";

const ITEMS = [
  {
    src: "/brand/euzim-cast-family.png",
    alt: "Família saltando de um livro mágico",
    width: 1123,
    height: 844,
    text: "Construa histórias envolvendo toda a família, gerando maior proximidade",
  },
  {
    src: "/brand/euzim-cast-friends.png",
    alt: "Várias crianças saltando de um livro mágico",
    width: 1130,
    height: 784,
    text: "Construa histórias em colaboração com amigos na plataforma",
  },
  {
    src: "/brand/euzim-cast-pets-toys.png",
    alt: "Pets e brinquedos saltando de um livro mágico",
    width: 1144,
    height: 824,
    text: "Construa histórias interagindo com os pets e brinquedos favoritos da criança",
  },
] as const;

export function LandingCast() {
  return (
    <section
      id="elenco"
      aria-labelledby="cast-heading"
      className="landing-cast relative z-10 px-5 py-16 sm:px-8 sm:py-20 md:px-12 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          <h2
            id="cast-heading"
            className="font-story-display text-2xl uppercase text-[var(--euzim-ink)] sm:text-3xl md:text-[2.1rem]"
          >
            Crie histórias com amigos e familiares
          </h2>
          <p className="font-story-body mt-3 text-base leading-relaxed text-[var(--euzim-ink-soft)] sm:text-[1.05rem]">
            Crie histórias com até 5 personagens (avatares) diferentes
          </p>
        </div>

        <ul className="landing-cast-grid">
          {ITEMS.map((item) => (
            <li key={item.src} className="landing-cast-item">
              <div className="landing-cast-visual">
                <Image
                  src={item.src}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  className="landing-cast-image h-auto w-full bg-transparent object-contain"
                  sizes="(max-width: 900px) 88vw, 30vw"
                />
              </div>
              <p className="landing-cast-copy font-story-body">
                {item.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
