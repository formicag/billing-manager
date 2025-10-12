import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Typography,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import apiService from '../services/api';

const ServiceDetail = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [service, setService] = useState(null);
  const [costs, setCosts] = useState([]);
  const [resourceCosts, setResourceCosts] = useState([]);
  const [selectedTag, setSelectedTag] = useState('all');
  const [availableTags, setAvailableTags] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadServiceData();
  }, [serviceId]);

  const loadServiceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [serviceData, costsData, resourceData] = await Promise.all([
        apiService.getService(serviceId),
        apiService.getCosts({ serviceId, limit: 30 }),
        apiService.getResourceCosts(serviceId),
      ]);

      setService(serviceData);
      setCosts(costsData);
      setResourceCosts(resourceData);

      // Extract unique tags
      const tags = new Set();
      resourceData.forEach(resource => {
        if (resource.tags) {
          Object.keys(resource.tags).forEach(tag => tags.add(tag));
        }
      });
      setAvailableTags(Array.from(tags));
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load service data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiService.triggerCostCollection(serviceId);
      toast.success('Cost collection triggered successfully');
      setTimeout(() => loadServiceData(), 2000);
    } catch (err) {
      toast.error('Failed to refresh costs: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTagChange = (event) => {
    setSelectedTag(event.target.value);
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Prepare chart data
  const chartData = costs
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(cost => ({
      date: formatDate(cost.date),
      cost: parseFloat(cost.amount) || 0,
    }));

  // Filter resources by selected tag
  const filteredResources = selectedTag === 'all'
    ? resourceCosts
    : resourceCosts.filter(resource =>
        resource.tags && Object.keys(resource.tags).includes(selectedTag)
      );

  // Prepare resource breakdown data for chart
  const resourceChartData = filteredResources
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10)
    .map(resource => ({
      name: resource.resourceName || resource.resourceId,
      cost: parseFloat(resource.cost) || 0,
    }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="back"
            onClick={() => navigate('/')}
            edge="start"
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {service ? service.name || serviceId.toUpperCase() : 'Service Details'}
          </Typography>
          <Button
            color="inherit"
            startIcon={refreshing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            Refresh
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <>
            {/* Service Info */}
            {service && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="h5" gutterBottom>
                        {service.name || serviceId.toUpperCase()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Service ID: {serviceId}
                      </Typography>
                    </Box>
                    <Chip
                      label={service.enabled ? 'Active' : 'Inactive'}
                      color={service.enabled ? 'success' : 'default'}
                    />
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Cost Trend Chart */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Cost Trend (Last 30 Days)
                </Typography>
                {chartData.length === 0 ? (
                  <Alert severity="info">No cost data available</Alert>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis
                        dataKey="date"
                        stroke="#999"
                        tick={{ fill: '#999' }}
                      />
                      <YAxis
                        stroke="#999"
                        tick={{ fill: '#999' }}
                        tickFormatter={(value) => `$${value.toFixed(2)}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e1e1e',
                          border: '1px solid #444',
                          borderRadius: '4px',
                        }}
                        formatter={(value) => [`$${value.toFixed(2)}`, 'Cost']}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="cost"
                        stroke="#90caf9"
                        strokeWidth={2}
                        dot={{ fill: '#90caf9' }}
                        name="Daily Cost"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Resource Breakdown */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Resource Breakdown
                  </Typography>
                  {availableTags.length > 0 && (
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Filter by Tag</InputLabel>
                      <Select
                        value={selectedTag}
                        onChange={handleTagChange}
                        label="Filter by Tag"
                      >
                        <MenuItem value="all">All Resources</MenuItem>
                        {availableTags.map(tag => (
                          <MenuItem key={tag} value={tag}>
                            {tag}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>

                {resourceChartData.length === 0 ? (
                  <Alert severity="info">No resource data available</Alert>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={resourceChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <XAxis
                          dataKey="name"
                          stroke="#999"
                          tick={{ fill: '#999' }}
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis
                          stroke="#999"
                          tick={{ fill: '#999' }}
                          tickFormatter={(value) => `$${value.toFixed(2)}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e1e1e',
                            border: '1px solid #444',
                            borderRadius: '4px',
                          }}
                          formatter={(value) => [`$${value.toFixed(2)}`, 'Cost']}
                        />
                        <Bar dataKey="cost" fill="#90caf9" />
                      </BarChart>
                    </ResponsiveContainer>

                    <TableContainer component={Paper} sx={{ mt: 3 }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Resource</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell align="right">Cost</TableCell>
                            <TableCell>Tags</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredResources
                            .sort((a, b) => b.cost - a.cost)
                            .map((resource, index) => (
                              <TableRow key={index}>
                                <TableCell>{resource.resourceName || resource.resourceId}</TableCell>
                                <TableCell>{resource.resourceType || 'N/A'}</TableCell>
                                <TableCell align="right">
                                  {formatCurrency(resource.cost)}
                                </TableCell>
                                <TableCell>
                                  {resource.tags && Object.keys(resource.tags).length > 0 ? (
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                      {Object.entries(resource.tags).slice(0, 3).map(([key, value]) => (
                                        <Chip
                                          key={key}
                                          label={`${key}: ${value}`}
                                          size="small"
                                          variant="outlined"
                                        />
                                      ))}
                                    </Box>
                                  ) : (
                                    'No tags'
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </Container>
    </Box>
  );
};

export default ServiceDetail;
