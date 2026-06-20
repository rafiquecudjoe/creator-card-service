const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const { CreatorCardMessages } = require('@app/messages');
const deleteCreatorCard = require('@app/services/creator-card/delete-creator-card');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'delete',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info({ requestContext: rc, response: rs }, 'delete-creator-card-completed');
  },
  async handler(rc, helpers) {
    const data = await deleteCreatorCard({
      slug: rc.params.slug,
      creator_reference: rc.body.creator_reference,
    });

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.CARD_DELETED,
      data,
    };
  },
});
