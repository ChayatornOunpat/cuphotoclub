export default defineEventHandler(async () => {
  const posts = await postStore.list()
  return posts.filter(post => post.visibility === 'public')
})
