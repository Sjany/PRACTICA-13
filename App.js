import React, { useState, useEffect, useMemo, useContext, createContext, useCallback } from 'react';
import {View, FlatList, Text, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView, ScrollView, Alert, Button,
} from 'react-native';

import { styles } from './styles';

import axios from 'axios';
import { NavigationContainer, useIsFocused } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';

const Stack = createStackNavigator();

// --- Constantes de Sincronización y Paginación ---
const POSTS_PER_PAGE = 15;
const API_URL = 'https://dev.to/api/articles?per_page=100';
const STORAGE_KEY_POSTS = '@my_posts';
const STORAGE_KEY_SYNC_QUEUE = '@my_posts_sync_queue';

// --- Tipos de Sincronización ---
const SYNC_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
};

const SyncContext = createContext();
const useSync = () => useContext(SyncContext);

function SyncProvider({ children }) {
  const [isOffline, setIsOffline] = useState(false);
  const [refreshList, setRefreshList] = useState(false);

  // Añade una acción a la cola de sincronización de AsyncStorage
  const addToSyncQueue = async (action) => {
    try {
      const queueData = await AsyncStorage.getItem(STORAGE_KEY_SYNC_QUEUE);
      let queue = queueData ? JSON.parse(queueData) : [];
      queue.push(action);
      await AsyncStorage.setItem(STORAGE_KEY_SYNC_QUEUE, JSON.stringify(queue));
      console.log('Acción añadida a la cola:', action.type);
    } catch (e) {
      console.error('Error añadiendo a la cola:', e);
    }
  };

  // Procesa todos los elementos pendientes en la cola
  const processSyncQueue = async () => {
    try {
      const queueData = await AsyncStorage.getItem(STORAGE_KEY_SYNC_QUEUE);
      const postsData = await AsyncStorage.getItem(STORAGE_KEY_POSTS);
      let queue = queueData ? JSON.parse(queueData) : [];
      let posts = postsData ? JSON.parse(postsData) : [];

      if (queue.length === 0) {
        console.log(' Cola de sincronización vacía, nada que hacer.');
        return;
      }

      Alert.alert('Sincronizando', `Procesando ${queue.length} cambios pendientes...`);

      console.log('--- INICIO DE SINCRONIZACION ---');
      let postsNeedUpdate = false;

      for (const action of queue) {
        console.log(`[Simulando] Enviando: ${action.type}`, action.payload.id);

        if (action.type === SYNC_ACTIONS.CREATE || action.type === SYNC_ACTIONS.UPDATE) {
          const postId = action.payload.id;
          const postIndex = posts.findIndex(p => p.id === postId);

          if (postIndex !== -1) {
            posts[postIndex].syncStatus = 'synced';
            postsNeedUpdate = true;
          }
        } else if (action.type === SYNC_ACTIONS.DELETE) {
          posts = posts.filter(p => p.id !== action.payload.id);
          postsNeedUpdate = true;
        }
      }

      if (postsNeedUpdate) {
        await AsyncStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(posts));
      }

      await AsyncStorage.setItem(STORAGE_KEY_SYNC_QUEUE, JSON.stringify([]));
      Alert.alert('Éxito', ' ¡Sincronización completada!');
      setRefreshList(prev => !prev);

    } catch (e) {
      console.error(' Error procesando la cola:', e);
      Alert.alert('Error', 'Hubo un fallo al intentar sincronizar los cambios.');
    }
  };

  // Suscripción al estado de red
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !(state.isConnected && state.isInternetReachable);

      setIsOffline(prevIsOffline => {
        if (!offline && prevIsOffline) {
          console.log(' ¡Conexión recuperada! Procesando cola...');
          processSyncQueue();
        }
        return offline;
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <SyncContext.Provider value={{ isOffline, addToSyncQueue, refreshList }}>
      {children}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.offlineText}>Estás sin conexión. Los cambios se sincronizarán al volver.</Text>
        </View>
      )}
    </SyncContext.Provider>
  );
}

// Componente para un ítem individual de la lista
const PostItem = React.memo(({ item, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.postItem}
      onPress={() => onPress(item.id)}
    >
      <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.postBodySnippet} numberOfLines={3}>
        {item.summary}
      </Text>
      <Text style={styles.postAuthor}>Autor: {item.authorName}</Text>

      <View style={styles.tagsContainer}>
        {item.isLocal && <Text style={[styles.tagBase, styles.tagLocal]}>[LOCAL]</Text>}
        {item.syncStatus === 'pending' && <Text style={[styles.tagBase, styles.tagPending]}>[Pendiente ☁️]</Text>}
        {item.syncStatus === 'synced' && <Text style={[styles.tagBase, styles.tagSynced]}>[Sincronizado ]</Text>}
      </View>
    </TouchableOpacity>
  );
});

// --- Pantalla 1: Lista de Posts 
function PostListScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const [allPosts, setAllPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isFocused = useIsFocused();
  const { isOffline, refreshList } = useSync();

  // Función para obtener datos de la API y fusionarlos con los locales
  const syncApi = useCallback(async (isManualRefresh = false) => {
    if (isOffline) {
      console.log("Offline, omitiendo sincronización de API.");
      if (isManualRefresh) {
        Alert.alert("Sin conexión", "No se puede refrescar. Verifica tu conexión a internet.");
      }
      return;
    }

    try {
      console.log("Sincronizando con la API...");
      const response = await axios.get(API_URL);
      const apiPostsFormatted = response.data.map((post) => ({
        id: post.id,
        title: post.title,
        summary: post.description,
        body: null,
        authorName: post.user.name,
        date: post.published_at,
        isLocal: false,
      }));

      const localData = await AsyncStorage.getItem(STORAGE_KEY_POSTS);
      let localPostsMap = new Map();
      if (localData) {
        const localPosts = JSON.parse(localData);
        localPostsMap = new Map(localPosts.map(p => [p.id, p]));
      }

      const mergedPosts = [];
      for (const apiPost of apiPostsFormatted) {
        const localPost = localPostsMap.get(apiPost.id);
        if (localPost) {
          const apiDate = new Date(apiPost.date);
          const localDate = new Date(localPost.date);
          if (localDate > apiDate || localPost.syncStatus === 'pending') {
            mergedPosts.push(localPost);
          } else {
            mergedPosts.push({
              ...apiPost,
              body: localPost.body || null,
              isLocal: localPost.isLocal,
              syncStatus: localPost.syncStatus === 'synced' ? 'synced' : null,
            });
          }
          localPostsMap.delete(apiPost.id);
        } else {
          mergedPosts.push(apiPost);
        }
      }
      for (const remainingLocalPost of localPostsMap.values()) {
        mergedPosts.push(remainingLocalPost);
      }

      mergedPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
      await AsyncStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(mergedPosts));
      setAllPosts(mergedPosts);
      console.log("Sincronización de API completada.");

    } catch (error) {
      console.error('Error en syncApi:', error);
      if (isManualRefresh) {
        Alert.alert("Error", "No se pudo completar la actualización desde la API.");
      }
    }
  }, [isOffline]);

  // Carga los posts: primero la caché, luego sincroniza en segundo plano
  const loadPosts = useCallback(async () => {
    setIsLoading(true);

    try {
      const localData = await AsyncStorage.getItem(STORAGE_KEY_POSTS);
      if (localData !== null) {
        const localPosts = JSON.parse(localData);
        localPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
        setAllPosts(localPosts);
      }
    } catch (e) { console.error("Error cargando datos locales", e); }

    setIsLoading(false);

    await syncApi();
  }, [syncApi]);

  // Efecto que se ejecuta al enfocar la pantalla o si el contexto pide refrescar
  useEffect(() => {
    if (isFocused) {
      loadPosts();
      setCurrentPage(1);
    }
  }, [isFocused, refreshList, loadPosts]);

  // Manejador de Pull-to-Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await syncApi(true);
    setIsRefreshing(false);
    setCurrentPage(1);
  };

  // --- Lógica de Filtrado y Paginación (Memorizada) ---
  const filteredPosts = useMemo(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    if (searchQuery === '') return allPosts;
    return allPosts.filter((post) => {
      const titleMatch = post.title.toLowerCase().includes(lowerCaseQuery);
      const authorMatch = post.authorName?.toLowerCase().includes(lowerCaseQuery);
      return titleMatch || authorMatch;
    });
  }, [searchQuery, allPosts]);

  const displayedPosts = useMemo(() => {
    return filteredPosts.slice(0, currentPage * POSTS_PER_PAGE);
  }, [filteredPosts, currentPage]);

  const loadMorePosts = () => {
    if (displayedPosts.length < filteredPosts.length) {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  const navigateToDetail = useCallback((postId) => {
    navigation.navigate('PostDetail', { postId });
  }, [navigation]);

  const renderPostItem = ({ item }) => (
    <PostItem item={item} onPress={navigateToDetail} />
  );

  return (
    <SafeAreaView style={styles.listContainer}>
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Buscar por título o autor..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setCurrentPage(1);
          }}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={displayedPosts}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id.toString()}
          onEndReached={loadMorePosts}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() =>
            displayedPosts.length < filteredPosts.length ? (
              <ActivityIndicator size="small" color="#888" style={{ marginVertical: 10 }} />
            ) : null
          }
          ListHeaderComponent={() => (
            <Button
              title="Borrar Caché y Recargar"
              color="#FF3B30"
              onPress={async () => {
                await AsyncStorage.multiRemove([STORAGE_KEY_POSTS, STORAGE_KEY_SYNC_QUEUE]);
                setAllPosts([]);
                Alert.alert("Caché Borrada", "Se eliminarán los posts locales y la cola de sincronización. Recargando...");
                loadPosts();
              }}
            />
          )}
          onRefresh={handleRefresh}
          refreshing={isRefreshing}
        />
      )}
    </SafeAreaView>
  );
}

// --- Pantalla 2: Detalle del Post
function PostDetailScreen({ route, navigation }) {
  const { postId } = route.params;
  const [post, setPost] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFocused = useIsFocused();
  const { isOffline, addToSyncQueue } = useSync();

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Confirmar Eliminación",
      "¿Estás seguro de que quieres borrar este post? (Se borrará localmente y se enviará a la cola de sincronización)",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar", style: "destructive", onPress: async () => {
            const localData = await AsyncStorage.getItem(STORAGE_KEY_POSTS);
            let posts = localData ? JSON.parse(localData) : [];

            const newPosts = posts.filter(p => p.id !== postId);
            await AsyncStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(newPosts));

            addToSyncQueue({
              type: SYNC_ACTIONS.DELETE,
              payload: { id: postId }
            });

            navigation.goBack();
          }
        }
      ]
    );
  }, [postId, addToSyncQueue, navigation]);

  useEffect(() => {
    const fetchPostDetails = async () => {
      setIsLoading(true);
      let foundPost = null;
      let posts = [];

      const localData = await AsyncStorage.getItem(STORAGE_KEY_POSTS);
      if (localData) {
        posts = JSON.parse(localData);
        foundPost = posts.find(p => p.id === postId);
      }

      if (foundPost && (foundPost.body || foundPost.isLocal)) {
        setPost(foundPost);
        setIsLoading(false);
      }
      else if (foundPost && !isOffline) {
        try {
          const response = await axios.get(`https://dev.to/api/articles/${postId}`);
          const fetchedPost = response.data;

          const completePost = {
            ...foundPost,
            id: fetchedPost.id, title: fetchedPost.title,
            authorName: fetchedPost.user.name, date: fetchedPost.published_at,
            body: fetchedPost.body_markdown || 'Contenido no disponible (API no lo proporcionó).',
            isLocal: false,
          };
          setPost(completePost);

          const updatedPosts = posts.map(p =>
            p.id === postId ? completePost : p
          );
          await AsyncStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(updatedPosts));

        } catch (error) {
          console.error("Error al cargar detalle desde API:", error);
          setPost(foundPost);
          Alert.alert("Error de Red", "No se pudo descargar el contenido completo del post.");
        } finally {
          setIsLoading(false);
        }
      }
      else if (foundPost) {
        setPost(foundPost);
        setIsLoading(false);
        if (!foundPost.isLocal) {
          Alert.alert("Sin conexión", "No se puede descargar el contenido completo del post.");
        }
      } else {
        setIsLoading(false);
        Alert.alert("Error", "Post no encontrado.");
        navigation.goBack();
      }
    };

    if (isFocused) {
      fetchPostDetails();
    }
  }, [postId, isFocused, isOffline, navigation]);

  // Configuración de botones de navegación (Editar/Borrar)
  useEffect(() => {
    if (post) {
      navigation.setOptions({
        title: post.isLocal ? `Local: ${post.title}` : '',
        headerRight: () => (
          <View style={styles.headerButtonContainer}>
            <TouchableOpacity
              onPress={() => navigation.navigate('PostForm', { post: post })}
              style={styles.headerIcon}
            >
              <Ionicons name="create-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              style={styles.headerIcon}
            >
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        ),
      });
    } else {
      navigation.setOptions({ title: 'Cargando...', headerRight: () => null });
    }
  }, [navigation, post, handleDelete]);

  if (isLoading || !post) {
    return (
      <SafeAreaView style={styles.detailContainer}>
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 30 }} />
      </SafeAreaView>
    );
  }

  const postDate = new Date(post.date).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.detailContainer}>
      <ScrollView contentContainerStyle={styles.detailScroll}>
        <Text style={styles.detailTitle}>{post.title}</Text>
        <View style={styles.detailMetaBox}>
          <Text style={styles.detailMetaText}>Autor: {post.authorName}</Text>
          <Text style={styles.detailMetaText} numberOfLines={1}> {postDate}</Text>
        </View>
        <Text style={styles.detailBody}>
          {post.body || 'Contenido no disponible.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Pantalla 3: Formulario para Crear/Editar Post ---
function PostFormScreen({ route, navigation }) {
  const existingPost = route.params?.post;
  const { addToSyncQueue } = useSync();

  const [title, setTitle] = useState(existingPost?.title || '');
  const [summary, setSummary] = useState(existingPost?.summary || '');
  const [body, setBody] = useState(existingPost?.body || '');

  const handleSave = async () => {
    if (!title || !body || !summary) {
      Alert.alert("Error", "Por favor completa el título, resumen y contenido.");
      return;
    }

    const localData = await AsyncStorage.getItem(STORAGE_KEY_POSTS);
    let posts = localData ? JSON.parse(localData) : [];
    let postToSave = {};
    let actionType = '';

    if (existingPost) {
      // --- Modo Edición ---
      postToSave = {
        ...existingPost,
        title, summary, body,
        date: new Date().toISOString(),
        syncStatus: 'pending',
      };
      const updatedPosts = posts.map(p =>
        p.id === existingPost.id ? postToSave : p
      );
      await AsyncStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(updatedPosts));
      actionType = SYNC_ACTIONS.UPDATE;
    } else {
      // --- Modo Creación ---
      postToSave = {
        id: `local_${Date.now()}`,
        title: title, summary: summary, body: body,
        authorName: "Usuario Local",
        date: new Date().toISOString(),
        isLocal: true,
        syncStatus: 'pending',
      };

      const updatedPosts = [postToSave, ...posts];
      await AsyncStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(updatedPosts));
      actionType = SYNC_ACTIONS.CREATE;
    }

    addToSyncQueue({ type: actionType, payload: postToSave });

    Alert.alert("Guardado", `Post ${existingPost ? 'actualizado' : 'creado'} localmente.`);
    navigation.goBack();
  };

  useEffect(() => {
    navigation.setOptions({
      title: existingPost ? ' Editar Post' : 'Crear Nuevo Post'
    });
  }, [existingPost, navigation]);


  return (
    <SafeAreaView style={styles.formContainer}>
      <ScrollView>
        <Text style={styles.formLabel}>Título</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="El título de tu post"
          maxLength={100}
        />
        <Text style={styles.formLabel}>Resumen</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={summary}
          onChangeText={setSummary}
          placeholder="Un breve resumen o descripción (máx. 250 caracteres)"
          multiline
          maxLength={250}
        />
        <Text style={styles.formLabel}>Contenido</Text>
        <TextInput
          style={[styles.input, styles.inputLarge]}
          value={body}
          onChangeText={setBody}
          placeholder="Escribe tu artículo aquí..."
          multiline
          textAlignVertical="top"
        />
        <View style={styles.saveButton}>
          <Button
            title={existingPost ? "Actualizar Post" : "Crear Post"}
            onPress={handleSave}
            color="#007AFF"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SyncProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerTintColor: '#007AFF',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen
            name="PostList"
            component={PostListScreen}
            options={({ navigation }) => ({
              title: 'Mis Publicaciones',
              headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('PostForm')} style={styles.headerIcon}>
                  <Ionicons name="add-circle-outline" size={30} color="#007AFF" />
                </TouchableOpacity>
              ),
            })}
          />
          <Stack.Screen
            name="PostDetail"
            component={PostDetailScreen}
            options={{ title: 'Detalle del Post' }}
          />
          <Stack.Screen
            name="PostForm"
            component={PostFormScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SyncProvider>
  );
}
