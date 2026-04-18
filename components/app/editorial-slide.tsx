/**
 * @deprecated Use `CarouselSlide` diretamente. Mantido como alias para não
 * quebrar imports existentes (`app/app/carousels`, `app/app/login`,
 * `app/app/create`). O template "editorial" foi revertido — o design Canva
 * antigo (CarouselSlide) é o oficial do Sequência Viral.
 */
import CarouselSlide from "./carousel-slide";
export type { SlideProps } from "./carousel-slide";
export default CarouselSlide;
