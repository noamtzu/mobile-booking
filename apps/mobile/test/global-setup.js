// Pin the zone so date/time assertions are the same on every machine.
module.exports = async () => {
  process.env.TZ = 'UTC';
};
