function boot() {
  console.warn(
    "[JobSupervisor] In-process workers have been removed. Start `node server/jobs/embedding-service.js` under your process supervisor."
  );
}

module.exports = {
  boot,
};
