const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const { CreatorCardMessages } = require('@app/messages');
const createCreatorCard = require('@app/services/creator-card/create-creator-card');

module.exports = createHandler({
  path: '/creator-cards',
  method: 'post',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info({ requestContext: rc, response: rs }, 'create-creator-card-completed');
  },
  async handler(rc, helpers) {
    const data = await createCreatorCard(rc.body);

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.CARD_CREATED,
      data,
    };
  },
});
