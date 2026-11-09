/**
 * Counter - atomic sequence numbers (used for readable order IDs: ORD-0001).
 * One document per sequence name: { _id: 'order', seq: 42 }.
 */
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

/**
 * Return the next number of a sequence (1, 2, 3 ...).
 * $inc + upsert is atomic, so two simultaneous orders never get the same number.
 */
counterSchema.statics.next = async function next(name) {
  const options = { new: true, upsert: true };
  try {
    const counter = await this.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, options);
    return counter.seq;
  } catch (err) {
    // Two first-ever upserts racing each other: the loser retries once
    if (err.code === 11000) {
      const counter = await this.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, options);
      return counter.seq;
    }
    throw err;
  }
};

module.exports = mongoose.model('Counter', counterSchema);
