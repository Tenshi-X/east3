import {
  Children,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconButton } from "./ui";

export default function CardCarousel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const id = useId();
  const cards = Children.toArray(children);
  const [position, setPosition] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  useEffect(() => {
    const el = track.current!;
    const update = () => {
      const slides = Array.from(el.children) as HTMLElement[];
      let closest = 0;
      slides.forEach((slide, index) => {
        if (
          Math.abs(slide.offsetLeft - el.scrollLeft) <
          Math.abs(slides[closest].offsetLeft - el.scrollLeft)
        )
          closest = index;
      });
      setPosition(closest);
      setAtStart(el.scrollLeft <= 2);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [cards.length]);
  const move = (direction: number) => {
    const el = track.current!;
    const next = el.children[
      Math.max(0, Math.min(cards.length - 1, position + direction))
    ] as HTMLElement;
    if (next)
      el.scrollTo({
        left: next.offsetLeft,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  };
  return (
    <section
      className="card-carousel"
      aria-labelledby={id}
      aria-roledescription="karusel"
    >
      <div className="carousel-heading">
        <div className="grow">
          <h2 id={id}>{title}</h2>
          <p className="meta">Geser untuk melihat lainnya</p>
        </div>
        <IconButton
          icon="chevron_left"
          label={`Kartu sebelumnya: ${title}`}
          disabled={atStart}
          onClick={() => move(-1)}
        />
        <IconButton
          icon="chevron_right"
          label={`Kartu berikutnya: ${title}`}
          disabled={atEnd}
          onClick={() => move(1)}
        />
      </div>
      <div
        className="carousel-track"
        ref={track}
        tabIndex={0}
        aria-label={`Kartu ${title}`}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            move(e.key === "ArrowRight" ? 1 : -1);
          }
        }}
      >
        {cards.map((card, index) => (
          <div
            className="carousel-slide"
            key={index}
            role="group"
            aria-roledescription="kartu"
            aria-label={`${index + 1} dari ${cards.length}`}
          >
            {card}
          </div>
        ))}
      </div>
    </section>
  );
}
