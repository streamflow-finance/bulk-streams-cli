declare module "map-stream" {
  type Transform = import("stream").Transform;

  function mapStream<TIn, TOut>(transformer: (data: TIn, callback: (error: null | Error, data: TOut) => void) => void): Transform<TIn, TOut>;

  export = mapStream;
}
