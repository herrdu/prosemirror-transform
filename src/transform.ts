import { Node as ProsemirrorNode, Schema, NodeRange, NodeType, Mark, MarkType, ContentMatch } from "prosemirror-model";

import { Mapping } from "./map";
import { Step, StepResult } from "./step";

export function TransformError(message: string) {
  let err = Error.call(this, message);
  err.__proto__ = TransformError.prototype;
  // XXX comment by duyutao
  // return err;
}

TransformError.prototype = Object.create(Error.prototype);
TransformError.prototype.constructor = TransformError;
TransformError.prototype.name = "TransformError";

// ::- Abstraction to build up and track an array of
// [steps](#transform.Step) representing a document transformation.
//
// Most transforming methods return the `Transform` object itself, so
// that they can be chained.
export class Transform<S extends Schema = any> {
  doc: ProsemirrorNode<S>;

  steps: Step[];

  docs: ProsemirrorNode[];

  mapping: Mapping;

  // :: (Node)
  // Create a transform that starts with the given document.
  constructor(doc: ProsemirrorNode<S>) {
    // :: Node
    // The current document (the result of applying the steps in the
    // transform).
    this.doc = doc;
    // :: [Step]
    // The steps in this transform.
    this.steps = [];
    // :: [Node]
    // The documents before each of the steps.
    this.docs = [];
    // :: Mapping
    // A mapping with the maps for each of the steps in this transform.
    this.mapping = new Mapping();
  }

  // :: Node The starting document.
  get before() {
    return this.docs.length ? this.docs[0] : this.doc;
  }

  /**
   * Add the given mark to the inline content between `from` and `to`.
   */
  addMark: (from: number, to: number, mark: Mark<S>) => this;

  /**
   * Remove marks from inline nodes between `from` and `to`. When `mark`
   * is a single mark, remove precisely that mark. When it is a mark type,
   * remove all marks of that type. When it is null, remove all marks of
   * any type.
   */
  removeMark: (from: number, to: number, mark?: Mark<S> | MarkType<S>) => this;

  /**
   * Removes all marks and nodes from the content of the node at `pos`
   * that don't match the given new parent node type. Accepts an
   * optional starting [content match](#model.ContentMatch) as third
   * argument.
   */
  clearIncompatible: (pos: number, parentType: NodeType<S>, match?: ContentMatch<S>) => this;

  // :: (step: Step) → this
  // Apply a new step in this transform, saving the result. Throws an
  // error when the step fails.
  step(object: Step): Transform<S> {
    let result = this.maybeStep(object) as any;
    if (result.failed) throw new TransformError(result.failed);
    return this;
  }

  // :: (Step) → StepResult
  // Try to apply a step in this transformation, ignoring it if it
  // fails. Returns the step result.
  maybeStep(step: Step): StepResult<S> {
    let result = step.apply(this.doc) as any;
    if (!result.failed) this.addStep(step, result.doc);
    return result;
  }

  // :: bool
  // True when the document has been changed (when there are any
  // steps).
  get docChanged() {
    return this.steps.length > 0;
  }

  addStep(step: Step, doc: ProsemirrorNode) {
    this.docs.push(this.doc);
    this.steps.push(step);
    this.mapping.appendMap(step.getMap());
    this.doc = doc;
  }

  /**
   * Split the content in the given range off from its parent, if there
   * is sibling content before or after it, and move it up the tree to
   * the depth specified by `target`. You'll probably want to use
   * [`liftTarget`](#transform.liftTarget) to compute `target`, to make
   * sure the lift is valid.
   */
  lift: (range: NodeRange<S>, target: number) => Transform;

  /**
   * Wrap the given [range](#model.NodeRange) in the given set of wrappers.
   * The wrappers are assumed to be valid in this position, and should
   * probably be computed with [`findWrapping`](#transform.findWrapping).
   */
  wrap: (
    range: NodeRange<S>,
    wrappers: Array<{ type: NodeType<S>; attrs?: { [key: string]: any } | null }>
  ) => Transform;

  /**
   * Set the type of all textblocks (partly) between `from` and `to` to
   * the given node type with the given attributes.
   */
  setBlockType: (from: number, to: number | undefined, type: NodeType<S>, attrs?: { [key: string]: any }) => Transform;

  /**
   * Change the type, attributes, and/or marks of the node at `pos`.
   * When `nodeType` is null, the existing node type is preserved,
   */
  setNodeMarkup: (pos: number, type?: NodeType<S>, attrs?: { [key: string]: any }, marks?: Array<Mark>) => Transform;

  /**
   * Split the node at the given position, and optionally, if `depth` is
   * greater than one, any number of nodes above that. By default, the
   * parts split off will inherit the node type of the original node.
   * This can be changed by passing an array of types and attributes to
   * use after the split.
   */
  split: (
    pos: number,
    depth?: number,
    typesAfter?: Array<{ type: NodeType<S>; attrs?: { [key: string]: any } | null }>
  ) => Transform;

  /**
   * Join the blocks around the given position. If depth is 2, their
   * last and first siblings are also joined, and so on.
   */
  join: (pos: number, depth?: number, p1?: boolean) => Transform;
}
