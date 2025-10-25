import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({

  listContainer: { flex: 1, backgroundColor: '#f0f2f5' },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    margin: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  postItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 4,
    marginHorizontal: 10,
    borderRadius: 10,

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
 
    elevation: 3,
  },
  postTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  postBodySnippet: { fontSize: 14, color: '#555', marginTop: 4, marginBottom: 8 },
  postAuthor: { fontSize: 12, color: '#888', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 5 },

 
  tagsContainer: {
    flexDirection: 'row',
    marginTop: 5,
  },
  tagBase: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  tagLocal: {
    backgroundColor: '#e6ffed',
    color: '#38a169',
  },
  tagPending: {
    backgroundColor: '#fffbe6',
    color: '#d69e2e',
  },
  tagSynced: {
    backgroundColor: '#ebf4ff',
    color: '#4299e1',
  },


  detailContainer: { flex: 1, backgroundColor: '#fff' },
  detailScroll: { padding: 20 },
  detailTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 10, color: '#1a1a1a' },
  detailMetaBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
  },
  detailMetaText: { fontSize: 14, color: '#666', flexShrink: 1 },
  detailBody: { fontSize: 16, lineHeight: 26, color: '#333' },

  headerButtonContainer: {
    flexDirection: 'row',
  },
  headerIcon: {
    marginRight: 15,
    padding: 2,
  },

  formContainer: { flex: 1, padding: 15, backgroundColor: '#fff' },
  formLabel: { fontSize: 16, fontWeight: '600', marginTop: 15, marginBottom: 8, color: '#333' },
  input: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#f9f9ff',
    fontSize: 16,
    color: '#333',
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputLarge: {
    height: 180,
    textAlignVertical: 'top',
  },
  saveButton: { marginTop: 30 },

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    padding: 12,
    justifyContent: 'center',
    zIndex: 10,
  },
  offlineText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
});